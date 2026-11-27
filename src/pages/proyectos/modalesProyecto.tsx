import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Entrada, EntradaNumero, Modal, Selector } from '@/components/ui';
import { dinero, ESTADOS_PROYECTO, hoy, MODOS_IVA, MODOS_IVA_AYUDA } from '@/lib/formato';
import type { EstadoProyecto, HitoProyecto, ModoIvaProyecto, Moneda, ProyectoDetalle } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { EditorPlan } from './EditorPlan';
import { hitosParaEnviar, sumaHitos, type HitoEditable } from './plan';

/** Después de cualquier cambio: el proyecto, el listado y todo lo que muestra saldos. */
function useAlGuardar(id: string, onCerrar: () => void) {
  const queryClient = useQueryClient();
  return (p?: ProyectoDetalle) => {
    if (p) queryClient.setQueryData(['proyecto', id], p);
    else void queryClient.invalidateQueries({ queryKey: ['proyecto', id] });
    void queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    void queryClient.invalidateQueries({ queryKey: ['cuenta-corriente'] });
    onCerrar();
  };
}

function Pie({ onCerrar, cargando, texto, deshabilitado }: { onCerrar: () => void; cargando: boolean; texto: string; deshabilitado?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Boton variante="terciario" onClick={onCerrar}>
        Cancelar
      </Boton>
      <Boton type="submit" cargando={cargando} disabled={deshabilitado}>
        {texto}
      </Boton>
    </div>
  );
}

/**
 * Entrega del cliente. Con recibo (lo normal) genera el recibo de cobro con el estado de la obra;
 * sin recibo sirve para cargar pagos viejos con su fecha original. Si paga en otra moneda, se usa el
 * tipo de cambio editado, el fijo de la obra o la cotización oficial de ARCA.
 */
export function EntregaModal({ proyecto, onCerrar, onRecibo }: { proyecto: ProyectoDetalle; onCerrar: () => void; onRecibo: (id: string) => void }) {
  const { pedir } = useApi();
  const alGuardar = useAlGuardar(proyecto.id, onCerrar);
  const [fecha, setFecha] = useState(hoy());
  const [moneda, setMoneda] = useState<Moneda>(proyecto.moneda);
  const [importe, setImporte] = useState('');
  const [tipoCambio, setTipoCambio] = useState('');
  const [medioPago, setMedioPago] = useState('Transferencia');
  const [observaciones, setObservaciones] = useState('');
  const [conRecibo, setConRecibo] = useState(true);
  const otraMoneda = moneda !== proyecto.moneda;
  const sugerido = useQuery({
    queryKey: ['cotizacion', proyecto.id],
    queryFn: () => pedir<{ tipoCambio: string; fuente: 'PROYECTO' | 'ARCA' }>(`/proyectos/cotizacion-dolar?proyectoId=${proyecto.id}`),
    enabled: otraMoneda,
    retry: false,
  });
  const tc = Number(tipoCambio || sugerido.data?.tipoCambio || 0);
  const equivalente = otraMoneda && tc > 0 && Number(importe) > 0 ? (moneda === 'ARS' ? Number(importe) / tc : Number(importe) * tc) : null;

  const guardar = useMutation({
    mutationFn: () =>
      pedir<{ reciboId: string | null }>(`/proyectos/${proyecto.id}/entregas`, 'POST', {
        fecha,
        moneda,
        importe: Number(importe).toFixed(2),
        ...(otraMoneda && tipoCambio ? { tipoCambio } : {}),
        medioPago: medioPago.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        conRecibo,
      }),
    onSuccess: (r) => {
      alGuardar();
      if (r.reciboId) onRecibo(r.reciboId);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Modal abierto titulo="Registrar entrega" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Campo>
          <Campo etiqueta="Medio de pago">
            <Entrada value={medioPago} onChange={(e) => setMedioPago(e.target.value)} maxLength={100} list="medios-pago" />
            <datalist id="medios-pago">
              {['Transferencia', 'Efectivo', 'Cheque', 'Echeq', 'Depósito'].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Campo>
          <Campo etiqueta="Moneda">
            <Selector value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Importe">
            <EntradaNumero value={importe} onValueChange={setImporte} sinNegativos required autoFocus />
          </Campo>
          {otraMoneda && (
            <Campo
              etiqueta="Tipo de cambio"
              className="sm:col-span-2"
              ayuda={
                sugerido.data
                  ? `${sugerido.data.fuente === 'PROYECTO' ? 'Fijo de la obra' : 'Cotización oficial de ARCA'}: ${dinero(sugerido.data.tipoCambio)}. Podés cambiarlo.`
                  : sugerido.isError
                    ? 'No se pudo traer la cotización de ARCA: cargalo a mano.'
                    : 'Buscando la cotización…'
              }
            >
              <EntradaNumero value={tipoCambio} onValueChange={setTipoCambio} placeholder={sugerido.data?.tipoCambio} maxDecimales={4} sinNegativos />
            </Campo>
          )}
        </div>
        {equivalente !== null && <Aviso tono="azul">Cancela {dinero(equivalente, proyecto.moneda)} de la obra.</Aviso>}
        <Campo etiqueta="Observaciones">
          <Entrada value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={1000} />
        </Campo>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={conRecibo} onChange={(e) => setConRecibo(e.target.checked)} />
          <span>
            Generar el recibo
            <span className="block text-xs text-fk-gris-texto">Destildalo para cargar entregas viejas que no llevan recibo.</span>
          </span>
        </label>
        <AlertaError error={guardar.error} />
        <Pie
          onCerrar={onCerrar}
          cargando={guardar.isPending}
          texto={conRecibo ? 'Registrar y generar recibo' : 'Registrar'}
          deshabilitado={!Number(importe) || (otraMoneda && !tc)}
        />
      </form>
    </Modal>
  );
}

/** Certificación de avance: la parte del hito que pasa a ser exigible. El porcentaje es solo una ayuda para calcular el importe. */
export function CertificacionModal({ proyecto, hito, onCerrar }: { proyecto: ProyectoDetalle; hito: HitoProyecto; onCerrar: () => void }) {
  const { pedir } = useApi();
  const alGuardar = useAlGuardar(proyecto.id, onCerrar);
  const [fecha, setFecha] = useState(hoy());
  const [descripcion, setDescripcion] = useState('');
  const [importe, setImporte] = useState('');
  const [porcentaje, setPorcentaje] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const resta = Number(hito.aCertificar);

  const guardar = useMutation({
    mutationFn: () =>
      pedir<ProyectoDetalle>(`/proyectos/${proyecto.id}/hitos/${hito.id}/certificaciones`, 'POST', {
        fecha,
        descripcion: descripcion.trim(),
        importe: Number(importe).toFixed(2),
        fechaVencimiento: vencimiento || null,
      }),
    onSuccess: alGuardar,
  });

  return (
    <Modal abierto titulo="Certificar avance" onCerrar={onCerrar}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <p className="text-sm text-fk-gris-texto">
          {hito.descripcion}: {dinero(hito.importe, proyecto.moneda)}. Quedan {dinero(resta, proyecto.moneda)} por certificar.
        </p>
        <Campo etiqueta="Descripción del avance">
          <Entrada
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
            maxLength={300}
            placeholder="Estructura y columnas"
            autoFocus
          />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="% del hito" ayuda="Ayuda para el importe.">
            <EntradaNumero
              value={porcentaje}
              onValueChange={(v) => {
                setPorcentaje(v);
                if (v) setImporte(((Number(hito.importe) * Number(v)) / 100).toFixed(2));
              }}
              sinNegativos
            />
          </Campo>
          <Campo etiqueta="Importe" className="sm:col-span-2">
            <EntradaNumero
              value={importe}
              onValueChange={(v) => {
                setImporte(v);
                setPorcentaje('');
              }}
              sinNegativos
              required
            />
          </Campo>
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Campo>
          <Campo etiqueta="Vencimiento" className="sm:col-span-2" ayuda="Desde esa fecha aparece como vencida y en los avisos.">
            <Entrada type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
          </Campo>
        </div>
        {Number(importe) > resta && (
          <Aviso tono="ambar">Supera lo que queda por certificar. Si el trabajo creció, cargá la diferencia como adicional.</Aviso>
        )}
        <AlertaError error={guardar.error} />
        <Pie onCerrar={onCerrar} cargando={guardar.isPending} texto="Certificar" deshabilitado={!Number(importe) || Number(importe) > resta} />
      </form>
    </Modal>
  );
}

/** Trabajo adicional: deuda aparte del acordado, asociada a la obra. */
export function AdicionalModal({ proyecto, onCerrar }: { proyecto: ProyectoDetalle; onCerrar: () => void }) {
  const { pedir } = useApi();
  const alGuardar = useAlGuardar(proyecto.id, onCerrar);
  const [fecha, setFecha] = useState(hoy());
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const guardar = useMutation({
    mutationFn: () =>
      pedir<ProyectoDetalle>(`/proyectos/${proyecto.id}/adicionales`, 'POST', {
        fecha,
        concepto: concepto.trim(),
        importe: Number(importe).toFixed(2),
        fechaVencimiento: vencimiento || null,
      }),
    onSuccess: alGuardar,
  });
  return (
    <Modal abierto titulo="Agregar adicional" onCerrar={onCerrar}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <Campo etiqueta="Concepto">
          <Entrada
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            required
            maxLength={120}
            placeholder="Canaleta adicional"
            autoFocus
          />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta={`Importe (${proyecto.moneda === 'USD' ? 'dólares' : 'pesos'})`} className="sm:col-span-3">
            <EntradaNumero value={importe} onValueChange={setImporte} sinNegativos required />
          </Campo>
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Campo>
          <Campo etiqueta="Vencimiento" className="sm:col-span-2">
            <Entrada type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
          </Campo>
        </div>
        <AlertaError error={guardar.error} />
        <Pie onCerrar={onCerrar} cargando={guardar.isPending} texto="Agregar" deshabilitado={!Number(importe)} />
      </form>
    </Modal>
  );
}

/** Monto acordado y plan. Los hitos con cobros solo cambian descripción y vencimiento. */
export function PlanModal({ proyecto, onCerrar }: { proyecto: ProyectoDetalle; onCerrar: () => void }) {
  const { pedir } = useApi();
  const alGuardar = useAlGuardar(proyecto.id, onCerrar);
  const [montoAcordado, setMontoAcordado] = useState(proyecto.montoAcordado ?? '');
  const [hitos, setHitos] = useState<HitoEditable[]>(() =>
    proyecto.hitos.map((h) => ({
      id: h.id,
      clave: h.id,
      descripcion: h.descripcion,
      importe: h.importe,
      fechaVencimiento: h.fechaVencimiento ?? '',
      porCertificacion: h.porCertificacion,
      bloqueado: !h.editable,
    })),
  );
  const descuadre = Boolean(montoAcordado) && hitos.length > 0 && Math.abs(sumaHitos(hitos) - Number(montoAcordado)) > 0.004;
  const guardar = useMutation({
    mutationFn: () =>
      pedir<ProyectoDetalle>(`/proyectos/${proyecto.id}/plan`, 'PUT', {
        montoAcordado: montoAcordado ? Number(montoAcordado).toFixed(2) : null,
        hitos: montoAcordado ? hitosParaEnviar(hitos) : [],
      }),
    onSuccess: alGuardar,
  });
  return (
    <Modal abierto titulo="Monto acordado y plan de pagos" onCerrar={onCerrar}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <Campo etiqueta="Monto acordado" ayuda="Si ya hubo cobros, ajustá con hitos nuevos o con adicionales.">
          <EntradaNumero value={montoAcordado} onValueChange={setMontoAcordado} sinNegativos />
        </Campo>
        {montoAcordado && <EditorPlan hitos={hitos} onCambiar={setHitos} montoAcordado={montoAcordado} moneda={proyecto.moneda} />}
        <AlertaError error={guardar.error} />
        <Pie onCerrar={onCerrar} cargando={guardar.isPending} texto="Guardar plan" deshabilitado={descuadre} />
      </form>
    </Modal>
  );
}

/** Nombre, ubicación, estado, modo de IVA y tipo de cambio fijo. */
export function DatosProyectoModal({ proyecto, onCerrar }: { proyecto: ProyectoDetalle; onCerrar: () => void }) {
  const { pedir } = useApi();
  const alGuardar = useAlGuardar(proyecto.id, onCerrar);
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [ubicacion, setUbicacion] = useState(proyecto.ubicacion ?? '');
  const [estado, setEstado] = useState<EstadoProyecto>(proyecto.estado);
  const [modoIva, setModoIva] = useState<ModoIvaProyecto>(proyecto.modoIva);
  const [tipoCambioFijo, setTipoCambioFijo] = useState(proyecto.tipoCambioFijo ?? '');
  const [observaciones, setObservaciones] = useState(proyecto.observaciones ?? '');
  const guardar = useMutation({
    mutationFn: () =>
      pedir<ProyectoDetalle>(`/proyectos/${proyecto.id}`, 'PATCH', {
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim() || null,
        estado,
        modoIva,
        tipoCambioFijo: tipoCambioFijo || null,
        observaciones: observaciones.trim() || null,
        ...(estado !== 'EN_CURSO' && !proyecto.fechaFin ? { fechaFin: hoy() } : {}),
      }),
    onSuccess: alGuardar,
  });
  return (
    <Modal abierto titulo="Editar datos" onCerrar={onCerrar}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <Campo etiqueta="Nombre">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={200} />
        </Campo>
        <Campo etiqueta="Ubicación">
          <Entrada value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} maxLength={300} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Estado" ayuda="Se puede finalizar con saldo: sigue en la cuenta corriente.">
            <Selector value={estado} onChange={(e) => setEstado(e.target.value as EstadoProyecto)}>
              {Object.entries(ESTADOS_PROYECTO).map(([v, t]) => (
                <option key={v} value={v}>
                  {t.texto}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="IVA" ayuda={MODOS_IVA_AYUDA[modoIva]}>
            <Selector value={modoIva} onChange={(e) => setModoIva(e.target.value as ModoIvaProyecto)}>
              {Object.entries(MODOS_IVA).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Tipo de cambio fijo" ayuda="Opcional. Gana sobre la cotización de ARCA.">
            <EntradaNumero value={tipoCambioFijo} onValueChange={setTipoCambioFijo} maxDecimales={4} sinNegativos />
          </Campo>
        </div>
        <Campo etiqueta="Observaciones">
          <Entrada value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={2000} />
        </Campo>
        {modoIva !== proyecto.modoIva && <Aviso tono="azul">Al guardar se recalcula lo que suma cada factura de la obra.</Aviso>}
        <AlertaError error={guardar.error} />
        <Pie onCerrar={onCerrar} cargando={guardar.isPending} texto="Guardar" />
      </form>
    </Modal>
  );
}
