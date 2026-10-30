import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertaError, Aviso, Boton, Campo, Cargando, ContenedorTabla, EncabezadoPagina, Entrada, EtiquetaEstado, Modal, Tarjeta } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  CONCEPTOS,
  CONDICIONES_IVA,
  dinero,
  esFactura,
  ESTADOS,
  fecha,
  letraDe,
  numeroComprobante,
  tipoLargo,
  unidadTexto,
} from '@/lib/formato';
import type { Comprobante } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { EditorComprobante } from './EditorComprobante';

const EDITABLES = ['BORRADOR', 'RECHAZADO'];

export function ComprobanteDetallePage() {
  const { id = '' } = useParams();
  const { pedir } = useApi();
  const queryClient = useQueryClient();

  const { data: c, error } = useQuery({
    queryKey: ['comprobante', id],
    queryFn: () => pedir<Comprobante>(`/comprobantes/${id}`),
    // Mientras ARCA no contestó, refrescar solo: el cron del backend termina lo que quedó colgado.
    refetchInterval: (q) => (q.state.data?.estado === 'EMITIENDO' ? 3_000 : q.state.data?.estado === 'PENDIENTE_VERIFICACION' ? 20_000 : false),
  });

  function actualizar(nuevo: Comprobante) {
    queryClient.setQueryData(['comprobante', nuevo.id], nuevo);
    void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
  }

  if (error) return <AlertaError error={error} />;
  if (!c) return <Cargando />;

  const editable = EDITABLES.includes(c.estado);

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={tipoLargo(c.tipo)}
        migas={[
          { texto: 'Comprobantes', a: '/comprobantes' },
          { texto: `${tipoLargo(c.tipo)} ${numeroComprobante(c.puntoVenta.numero, c.numero)}` },
        ]}
        junto={
          <>
            <span className="text-xl text-fk-gris-texto tabular-nums">{numeroComprobante(c.puntoVenta.numero, c.numero)}</span>
            <EtiquetaEstado estado={ESTADOS[c.estado]} />
          </>
        }
        descripcion={
          c.asociado && (
            <>
              Asociada a{' '}
              <Link to={`/comprobantes/${c.asociado.id}`} className="font-medium text-fk-fiordo underline underline-offset-2">
                {tipoLargo(c.asociado.tipo)} <span className="tabular-nums">{numeroComprobante(c.asociado.puntoVenta.numero, c.asociado.numero)}</span>
              </Link>
            </>
          )
        }
      />

      {c.ambiente === 'HOMOLOGACION' && (
        <Aviso>Ambiente de pruebas: este comprobante no tiene validez fiscal.</Aviso>
      )}
      {c.estado === 'RECHAZADO' && (
        <AlertaError
          mensaje={`ARCA rechazó el comprobante: ${c.errorMensaje ?? 'sin detalle'}. Corregilo y volvé a emitir.`}
          detalle={c.errorDetalle}
        />
      )}
      {c.estado === 'EMITIENDO' && <Aviso tono="azul">Pidiendo la autorización a ARCA…</Aviso>}
      {c.estado === 'PENDIENTE_VERIFICACION' && <PendienteVerificacion comprobante={c} onActualizado={actualizar} />}

      {editable ? (
        <EditorComprobante
          key={`${c.id}:${c.version}`}
          comprobante={c}
          onGuardado={actualizar}
          acciones={({ sucio }) => (
            <>
              <EliminarBorrador comprobante={c} />
              <EmitirBoton comprobante={c} deshabilitado={sucio} onActualizado={actualizar} />
            </>
          )}
        />
      ) : (
        <VistaComprobante comprobante={c} />
      )}
    </div>
  );
}

function PendienteVerificacion({ comprobante: c, onActualizado }: { comprobante: Comprobante; onActualizado: (c: Comprobante) => void }) {
  const { pedir } = useApi();
  const verificar = useMutation({
    mutationFn: () => pedir<Comprobante>(`/comprobantes/${c.id}/verificar`, 'POST'),
    onSuccess: onActualizado,
  });
  return (
    <div className="space-y-2">
      <Aviso>
        <p>
          No sabemos todavía si ARCA autorizó el comprobante (número reservado {c.numeroReservado ?? '—'}). No lo vuelvas a
          emitir: el sistema lo consulta solo cada minuto, o podés verificarlo ahora.
        </p>
        {c.errorMensaje && <p className="mt-1 text-xs">Último error: {c.errorMensaje}</p>}
        <Boton variante="terciario" className="mt-3" cargando={verificar.isPending} onClick={() => verificar.mutate()}>
          Verificar ahora
        </Boton>
      </Aviso>
      <AlertaError error={verificar.error} />
    </div>
  );
}

function EmitirBoton({
  comprobante: c,
  deshabilitado,
  onActualizado,
}: {
  comprobante: Comprobante;
  deshabilitado: boolean;
  onActualizado: (c: Comprobante) => void;
}) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  // Una clave por confirmación. Solo se reusa si la request no llegó a tener respuesta (corte de red):
  // así reintentar no puede emitir dos veces.
  const [clave, setClave] = useState('');

  const emitir = useMutation({
    mutationFn: () =>
      pedir<Comprobante>(`/comprobantes/${c.id}/emitir`, 'POST', { version: c.version }, { 'Idempotency-Key': clave }),
    onSuccess: (nuevo) => {
      setAbierto(false);
      onActualizado(nuevo);
    },
    onError: (err) => {
      const huboRespuesta = err instanceof ApiError && err.status !== 0;
      if (huboRespuesta) setClave(crypto.randomUUID());
      // Rechazo de ARCA (422): el comprobante ya tiene el error guardado y se muestra arriba.
      if (err instanceof ApiError && err.status === 422) setAbierto(false);
      void queryClient.invalidateQueries({ queryKey: ['comprobante', c.id] });
      void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
    },
  });

  function abrir() {
    setClave(crypto.randomUUID());
    emitir.reset();
    setAbierto(true);
  }

  const sinRespuesta = emitir.error instanceof ApiError && emitir.error.status === 0;

  return (
    <>
      <Boton onClick={abrir} disabled={deshabilitado} title={deshabilitado ? 'Guardá los cambios antes de emitir' : undefined}>
        {c.estado === 'RECHAZADO' ? 'Reintentar emisión' : 'Emitir'}
      </Boton>
      <Modal abierto={abierto} titulo={`Emitir ${tipoLargo(c.tipo)}`} onCerrar={() => !emitir.isPending && setAbierto(false)}>
        <div className="space-y-4 text-sm">
          <p>
            Vas a pedir el CAE a ARCA para una <strong>{tipoLargo(c.tipo)}</strong> a <strong>{c.cliente.razonSocial}</strong> por{' '}
            <strong>{dinero(c.importeTotal, c.moneda)}</strong>.
          </p>
          <p className="text-fk-gris-texto">
            Una vez autorizado no se puede modificar ni borrar: para corregirlo hay que hacer una nota de crédito.
          </p>
          {c.ambiente === 'HOMOLOGACION' && (
            <Aviso>Estás en el ambiente de pruebas: el comprobante no va a tener validez fiscal.</Aviso>
          )}
          {c.advertenciaLetra && <Aviso>{c.advertenciaLetra}</Aviso>}
          {sinRespuesta ? (
            <AlertaError mensaje="No hubo respuesta del servidor. Reintentá: si la primera vez llegó a emitirse, no se duplica." />
          ) : (
            <AlertaError error={emitir.error} />
          )}
          <div className="flex justify-end gap-2">
            <Boton variante="terciario" onClick={() => setAbierto(false)} disabled={emitir.isPending}>
              Cancelar
            </Boton>
            <Boton cargando={emitir.isPending} onClick={() => emitir.mutate()}>
              {sinRespuesta ? 'Reintentar' : 'Emitir'}
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}

function EliminarBorrador({ comprobante: c }: { comprobante: Comprobante }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const eliminar = useMutation({
    mutationFn: () => pedir<void>(`/comprobantes/${c.id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['comprobante', c.id] });
      void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
      navigate('/comprobantes', { replace: true });
    },
  });
  // Un comprobante que pasó por ARCA queda como registro; solo se borran los que nunca se intentaron emitir.
  if (c.numero !== null || c.numeroReservado !== null || c.estado !== 'BORRADOR') return null;

  return (
    <>
      {eliminar.error && <AlertaError error={eliminar.error} />}
      <Boton
        variante="destructivo"
        cargando={eliminar.isPending}
        onClick={() => {
          if (window.confirm('¿Eliminar este borrador? No se puede deshacer.')) eliminar.mutate();
        }}
      >
        Eliminar borrador
      </Boton>
    </>
  );
}

function VistaComprobante({ comprobante: c }: { comprobante: Comprobante }) {
  const { descargar } = useApi();
  const [errorPdf, setErrorPdf] = useState<unknown>(null);
  const [bajando, setBajando] = useState(false);
  const [nota, setNota] = useState<'NOTA_CREDITO' | 'NOTA_DEBITO' | null>(null);
  const discriminaIva = letraDe(c.tipo) !== 'C';
  const conCae = Boolean(c.cae) && (c.estado === 'EMITIDO' || c.estado === 'ANULADO');

  async function bajarPdf() {
    setErrorPdf(null);
    setBajando(true);
    try {
      await descargar(`/comprobantes/${c.id}/pdf`, `comprobante-${c.id}.pdf`);
    } catch (err) {
      setErrorPdf(err);
    } finally {
      setBajando(false);
    }
  }

  return (
    <div className="space-y-4">
      {conCae && (
        <Tarjeta
          titulo="Autorización de ARCA"
          acciones={
            <div className="flex flex-wrap gap-2">
              {esFactura(c.tipo) && c.estado === 'EMITIDO' && (
                <>
                  <Boton variante="terciario" onClick={() => setNota('NOTA_CREDITO')}>
                    Nota de crédito
                  </Boton>
                  <Boton variante="terciario" onClick={() => setNota('NOTA_DEBITO')}>
                    Nota de débito
                  </Boton>
                </>
              )}
              <Boton cargando={bajando} onClick={() => void bajarPdf()}>
                Descargar PDF
              </Boton>
            </div>
          }
        >
          <dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Dato titulo="CAE" valor={<span className="tabular-nums">{c.cae}</span>} />
            <Dato titulo="Vencimiento del CAE" valor={<span className="tabular-nums">{fecha(c.caeVencimiento)}</span>} />
            <Dato titulo="Fecha del comprobante" valor={<span className="tabular-nums">{fecha(c.fechaEmision)}</span>} />
            <Dato titulo="Número" valor={<span className="tabular-nums">{numeroComprobante(c.puntoVenta.numero, c.numero)}</span>} />
          </dl>
          {c.estado === 'ANULADO' && <p className="mt-4 text-sm text-fk-gris-texto">Anulado por una nota de crédito por el total.</p>}
          <div className="mt-3">
            <AlertaError error={errorPdf} />
          </div>
        </Tarjeta>
      )}

      <Tarjeta titulo="Datos">
        <dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato titulo="Cliente" valor={c.cliente.razonSocial} />
          <Dato titulo="Condición IVA" valor={CONDICIONES_IVA[c.cliente.condicionIva]} />
          <Dato titulo="Concepto" valor={CONCEPTOS[c.concepto]} />
          <Dato titulo="Moneda" valor={c.moneda === 'USD' ? `Dólares (cotización ${c.cotizacion})` : 'Pesos'} />
          {c.concepto !== 'PRODUCTOS' && (
            <>
              <Dato titulo="Período" valor={`${fecha(c.fechaServicioDesde)} al ${fecha(c.fechaServicioHasta)}`} />
              <Dato titulo="Vencimiento de pago" valor={fecha(c.fechaVtoPago)} />
            </>
          )}
          {c.motivo && <Dato titulo="Motivo" valor={c.motivo} />}
          {c.observaciones && <Dato titulo="Observaciones" valor={c.observaciones} />}
        </dl>
      </Tarjeta>

      <Tarjeta titulo="Detalle">
        <ContenedorTabla>
          <table className="fk-tabla">
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="fk-num">Cantidad</th>
                <th className="fk-num">Precio unit.</th>
                <th className="fk-num">Bonif.</th>
                {discriminaIva && <th className="fk-num">IVA</th>}
                <th className="fk-num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {c.lineas.map((l) => (
                <tr key={l.id}>
                  <td>{l.descripcion}</td>
                  <td className="fk-num">
                    {Number(l.cantidad).toLocaleString('es-AR')} {unidadTexto(l.unidad, l.cantidad)}
                  </td>
                  <td className="fk-num">{dinero(l.precioUnitario, c.moneda)}</td>
                  <td className="fk-num">{Number(l.bonificacionPct) ? `${Number(l.bonificacionPct)} %` : '—'}</td>
                  {discriminaIva && <td className="fk-num">{Number(l.alicuotaIva)} %</td>}
                  <td className="fk-num">{dinero(discriminaIva ? l.importeNeto : l.importeTotal, c.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContenedorTabla>
        <dl className="mt-6 ml-auto max-w-xs space-y-1.5 border-t border-fk-borde pt-4 text-sm">
          {discriminaIva && (
            <>
              <Fila titulo="Neto gravado" valor={dinero(c.importeNetoGravado, c.moneda)} />
              {c.alicuotas.map((a) => (
                <Fila key={a.arcaId} titulo={`IVA sobre ${dinero(a.baseImponible, c.moneda)}`} valor={dinero(a.importe, c.moneda)} />
              ))}
            </>
          )}
          <Fila titulo="Total" valor={dinero(c.importeTotal, c.moneda)} fuerte />
        </dl>
      </Tarjeta>

      {c.asociadosDesde.length > 0 && (
        <Tarjeta titulo="Notas asociadas">
          <ul className="divide-y divide-fk-borde text-sm">
            {c.asociadosDesde.map((n) => (
              <li key={n.id} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2">
                <Link to={`/comprobantes/${n.id}`} className="font-medium text-fk-fiordo underline-offset-2 hover:underline">
                  {tipoLargo(n.tipo)}{' '}
                  <span className="tabular-nums">{n.numero !== null ? numeroComprobante(c.puntoVenta.numero, n.numero) : '(sin número)'}</span>
                </Link>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{dinero(n.importeTotal, c.moneda)}</span>
                  <EtiquetaEstado estado={ESTADOS[n.estado]} />
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {nota && <NotaModal key={nota} factura={c} clase={nota} onCerrar={() => setNota(null)} />}
    </div>
  );
}

function NotaModal({
  factura,
  clase,
  onCerrar,
}: {
  factura: Comprobante;
  clase: 'NOTA_CREDITO' | 'NOTA_DEBITO';
  onCerrar: () => void;
}) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [motivo, setMotivo] = useState('');
  const texto = clase === 'NOTA_CREDITO' ? 'nota de crédito' : 'nota de débito';

  const crear = useMutation({
    mutationFn: () => pedir<Comprobante>(`/comprobantes/${factura.id}/notas`, 'POST', { clase, motivo: motivo.trim() }),
    onSuccess: (n) => {
      queryClient.setQueryData(['comprobante', n.id], n);
      void queryClient.invalidateQueries({ queryKey: ['comprobante', factura.id] });
      void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
      navigate(`/comprobantes/${n.id}`);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Modal abierto titulo={`Nueva ${texto}`} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4 text-sm">
        <p>
          Se crea un borrador de {texto} {letraDe(factura.tipo)} sobre {tipoLargo(factura.tipo)}{' '}
          {numeroComprobante(factura.puntoVenta.numero, factura.numero)}, con las mismas líneas. Podés ajustar los importes antes de
          emitirla.
        </p>
        {clase === 'NOTA_CREDITO' && (
          <p className="text-fk-gris-texto">Si la nota de crédito es por el total, la factura queda anulada al emitirla.</p>
        )}
        <Campo etiqueta="Motivo">
          <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} required maxLength={500} autoFocus />
        </Campo>
        <AlertaError error={crear.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={crear.isPending}>
            Crear borrador
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="fk-etiqueta">{titulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function Fila({ titulo, valor, fuerte }: { titulo: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${fuerte ? 'border-t border-fk-borde pt-2 text-base font-semibold text-fk-fiordo' : ''}`}>
      <dt className={fuerte ? '' : 'text-fk-gris-texto'}>{titulo}</dt>
      <dd className="fk-num">{valor}</dd>
    </div>
  );
}
