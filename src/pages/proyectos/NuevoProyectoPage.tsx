import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { BarraAcciones, AlertaError, Boton, Campo, EncabezadoPagina, Entrada, EntradaNumero, Selector, SelectorBuscable, Tarjeta } from '@/components/ui';
import { MODOS_IVA, MODOS_IVA_AYUDA, hoy } from '@/lib/formato';
import { useEmpresa } from '@/lib/modulos';
import type { Cliente, ModoIvaProyecto, Moneda, ProyectoDetalle } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { ClienteModal } from '@/pages/clientes/ClienteModal';
import { EditorPlan } from './EditorPlan';
import { hitosParaEnviar, nuevoHito, sumaHitos, type HitoEditable } from './plan';

/** Alta de un proyecto (obra): cliente, datos, monto acordado y plan de pagos. */
export function NuevoProyectoPage() {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const { etiqueta, etiquetaPlural, etiquetaMin } = useEmpresa();
  const clientes = useQuery({
    queryKey: ['clientes', 'todos'],
    queryFn: () => pedir<Cliente[]>('/clientes'),
  });
  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '');
  const [altaCliente, setAltaCliente] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [modoIva, setModoIva] = useState<ModoIvaProyecto>('MAS_IVA');
  const [tipoCambioFijo, setTipoCambioFijo] = useState('');
  const [fechaInicio, setFechaInicio] = useState(hoy());
  const [montoAcordado, setMontoAcordado] = useState('');
  const [hitos, setHitos] = useState<HitoEditable[]>([]);
  const [observaciones, setObservaciones] = useState('');

  const descuadre = Boolean(montoAcordado) && hitos.length > 0 && Math.abs(sumaHitos(hitos) - Number(montoAcordado)) > 0.004;

  const crear = useMutation({
    meta: { exito: `Listo: ${etiquetaMin} en marcha.`, error: `No se pudo crear: ${etiquetaMin}.` },
    mutationFn: () =>
      pedir<ProyectoDetalle>('/proyectos', 'POST', {
        clienteId,
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim() || undefined,
        moneda,
        modoIva,
        tipoCambioFijo: moneda === 'USD' && tipoCambioFijo ? tipoCambioFijo : null,
        fechaInicio: fechaInicio || undefined,
        observaciones: observaciones.trim() || undefined,
        montoAcordado: montoAcordado ? Number(montoAcordado).toFixed(2) : null,
        hitos: montoAcordado ? hitosParaEnviar(hitos) : [],
      }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      navigate(`/proyectos/${p.id}`, { replace: true });
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <form onSubmit={enviar} className="space-y-6">
      <EncabezadoPagina
        titulo={`Nueva ${etiquetaMin}`}
        tituloEnBarra
        migas={[{ texto: etiquetaPlural, a: '/proyectos' }, { texto: `Nueva ${etiquetaMin}` }]}
      />
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Tarjeta titulo="Datos">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Cliente" className="sm:col-span-2">
              <div className="flex gap-2">
                <SelectorBuscable
                  value={clienteId}
                  onChange={setClienteId}
                  placeholder="Elegí un cliente"
                  aria-label="Cliente"
                  opciones={(clientes.data ?? []).filter((c) => c.activo).map((c) => ({ value: c.id, label: c.razonSocial }))}
                  className="flex-1"
                />
                <Boton variante="terciario" onClick={() => setAltaCliente(true)} className="shrink-0">
                  <UserPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Nuevo
                </Boton>
              </div>
            </Campo>
            <Campo
              etiqueta="Nombre"
              className="sm:col-span-2"
              ayuda={`No se repite dentro del mismo cliente. Por ejemplo: Galpón sucursal Costa Doll.`}
            >
              <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={200} />
            </Campo>
            <Campo etiqueta="Ubicación">
              <Entrada value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} maxLength={300} />
            </Campo>
            <Campo etiqueta="Inicio">
              <Entrada type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </Campo>
            <Campo etiqueta="Moneda" ayuda="Si el cliente paga en otra moneda, cada entrega guarda su tipo de cambio.">
              <Selector value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </Selector>
            </Campo>
            {moneda === 'USD' ? (
              <Campo etiqueta="Tipo de cambio fijo" ayuda="Opcional. Sin esto se usa la cotización oficial de ARCA del día.">
                <EntradaNumero value={tipoCambioFijo} onValueChange={setTipoCambioFijo} maxDecimales={4} sinNegativos />
              </Campo>
            ) : (
              <div />
            )}
            <Campo etiqueta="Observaciones" className="sm:col-span-2">
              <Entrada value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={2000} />
            </Campo>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Monto acordado y plan de pagos">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Monto acordado" ayuda="Opcional. Sin acordado, las facturas suman su total.">
                <EntradaNumero value={montoAcordado} onValueChange={setMontoAcordado} sinNegativos />
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
            </div>
            {montoAcordado ? (
              <EditorPlan hitos={hitos} onCambiar={setHitos} montoAcordado={montoAcordado} moneda={moneda} />
            ) : (
              <p className="text-sm text-fk-gris-texto">Cargá el monto acordado para dividirlo en hitos.</p>
            )}
            {hitos.length === 0 && montoAcordado && (
              <Boton
                variante="fantasma"
                onClick={() =>
                  setHitos([
                    nuevoHito('Anticipo', ''),
                    {
                      ...nuevoHito('Según avance de obra', ''),
                      porCertificacion: true,
                    },
                    nuevoHito('Al terminar', ''),
                  ])
                }
              >
                Usar anticipo, avance y final
              </Boton>
            )}
          </div>
        </Tarjeta>
      </div>
      <AlertaError error={crear.error} />
      <BarraAcciones>
        <Boton variante="terciario" onClick={() => navigate('/proyectos')}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={crear.isPending} disabled={!clienteId || !nombre.trim() || descuadre}>
          Crear {etiqueta.toLowerCase()}
        </Boton>
      </BarraAcciones>
      <ClienteModal
        abierto={altaCliente}
        valoresIniciales={{
          tipoDocumento: 'CONSUMIDOR_FINAL',
          condicionIva: 'CONSUMIDOR_FINAL',
        }}
        onCerrar={() => setAltaCliente(false)}
        onGuardado={(c) => {
          void queryClient.invalidateQueries({ queryKey: ['clientes'] });
          setClienteId(c.id);
          setAltaCliente(false);
        }}
      />
    </form>
  );
}
