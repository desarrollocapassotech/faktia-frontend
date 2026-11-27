import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, HandCoins, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  AlertaError,
  Boton,
  BotonIcono,
  Cargando,
  ContenedorTabla,
  EncabezadoPagina,
  Etiqueta,
  EtiquetaEstado,
  Tarjeta,
  Vacio,
} from '@/components/ui';
import { dinero, ESTADOS_PROYECTO, fecha, MODOS_IVA } from '@/lib/formato';
import { useEmpresa } from '@/lib/modulos';
import type { HitoProyecto, ProyectoDetalle } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { Indicador } from '@/pages/cuenta-corriente/CuentaCorrientePage';
import { AdicionalModal, CertificacionModal, DatosProyectoModal, EntregaModal, PlanModal } from './modalesProyecto';

type ModalAbierto =
  | { tipo: 'entrega' }
  | { tipo: 'adicional' }
  | { tipo: 'plan' }
  | { tipo: 'datos' }
  | { tipo: 'certificar'; hito: HitoProyecto }
  | null;

/** Una obra: plan de pagos con certificaciones, adicionales y facturas, entregas y saldos. */
export function ProyectoDetallePage() {
  const { id = '' } = useParams();
  const { pedir, verEnPestana } = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { etiqueta, etiquetaPlural, etiquetaMin, tiene } = useEmpresa();
  const [modal, setModal] = useState<ModalAbierto>(null);
  const [errorPdf, setErrorPdf] = useState<unknown>(null);
  const { data: p, error } = useQuery({
    queryKey: ['proyecto', id],
    queryFn: () => pedir<ProyectoDetalle>(`/proyectos/${id}`),
  });

  const quitarCertificacion = useMutation({
    mutationFn: (certificacionId: string) => pedir<ProyectoDetalle>(`/proyectos/${id}/certificaciones/${certificacionId}`, 'DELETE'),
    onSuccess: (d) => {
      queryClient.setQueryData(['proyecto', id], d);
      void queryClient.invalidateQueries({ queryKey: ['cuenta-corriente'] });
    },
  });
  const eliminar = useMutation({
    mutationFn: () => pedir(`/proyectos/${id}`, 'DELETE'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      navigate('/proyectos', { replace: true });
    },
  });

  async function verRecibo(reciboId: string) {
    setErrorPdf(null);
    try {
      await verEnPestana(`/recibos/${reciboId}/pdf`);
    } catch (err) {
      setErrorPdf(err);
    }
  }

  if (error) return <AlertaError error={error} />;
  if (!p) return <Cargando />;
  const $ = (v: string | number) => dinero(v, p.moneda);
  const s = p.saldos;
  const sinMovimientos = p.entregas.length === 0 && p.cargos.length === 0 && p.hitos.every((h) => h.editable);

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={p.nombre}
        tituloEnBarra
        migas={[{ texto: etiquetaPlural, a: '/proyectos' }, { texto: p.nombre }]}
        junto={<EtiquetaEstado estado={ESTADOS_PROYECTO[p.estado]} />}
        descripcion={
          <>
            <Link to={`/cuenta-corriente/${p.cliente.id}`} className="font-semibold text-fk-fiordo hover:underline">
              {p.cliente.razonSocial}
            </Link>
            {p.ubicacion ? ` · ${p.ubicacion}` : ''} · {p.moneda === 'USD' ? 'Dólares' : 'Pesos'}
            {p.montoAcordado ? ` · ${MODOS_IVA[p.modoIva]}` : ''}
            {p.tipoCambioFijo ? ` · TC fijo ${dinero(p.tipoCambioFijo)}` : ''}
          </>
        }
        acciones={
          <>
            {tiene('materiales') && (
              <Boton variante="terciario" onClick={() => navigate(`/materiales/listados/nuevo?proyecto=${p.id}`)}>
                <Package className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Listado de materiales
              </Boton>
            )}
            <Boton variante="terciario" onClick={() => setModal({ tipo: 'datos' })}>
              <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Editar datos
            </Boton>
            {p.estado !== 'CANCELADO' && (
              <Boton onClick={() => setModal({ tipo: 'entrega' })}>
                <HandCoins className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Registrar entrega
              </Boton>
            )}
          </>
        }
      />
      <AlertaError error={errorPdf ?? quitarCertificacion.error ?? eliminar.error} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Indicador
          titulo="Acordado"
          valor={s.montoAcordado ? $(s.montoAcordado) : 'Sin acordado'}
          ayuda={Number(s.adicionales) > 0 ? `Más ${$(s.adicionales)} de adicionales y facturas.` : undefined}
        />
        <Indicador titulo="Entregado" valor={$(s.totalEntregado)} />
        <Indicador titulo="Saldo" valor={$(s.saldo)} ayuda="Todo lo que falta cobrar." />
        <Indicador
          titulo="Exigible"
          valor={$(s.saldoExigible)}
          ayuda={Number(s.aCertificar) > 0 ? `${$(s.aCertificar)} todavía a certificar.` : 'Lo que se puede cobrar hoy.'}
        />
        <Indicador titulo="Vencido" valor={$(s.vencido)} alerta={Number(s.vencido) > 0} />
      </div>

      <Tarjeta
        titulo="Plan de pagos"
        acciones={
          <Boton variante="terciario" onClick={() => setModal({ tipo: 'plan' })}>
            {p.montoAcordado ? 'Editar plan' : 'Cargar acordado'}
          </Boton>
        }
      >
        {p.hitos.length === 0 ? (
          <Vacio>Sin monto acordado. Las facturas de esta {etiquetaMin} suman su total.</Vacio>
        ) : (
          <ContenedorTabla>
            <table className="fk-tabla">
              <thead>
                <tr>
                  <th>Hito</th>
                  <th>Vence</th>
                  <th className="fk-num">Importe</th>
                  <th className="fk-num">Pendiente</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {p.hitos.map((h) => (
                  <Fragment key={h.id}>
                    <tr>
                      <td>
                        <span className="font-medium">{h.descripcion}</span>
                        {h.porCertificacion && (
                          <span className="block text-xs text-fk-gris-texto">
                            Por certificación · certificado {$(h.certificado)} · a certificar {$(h.aCertificar)}
                          </span>
                        )}
                      </td>
                      <td className="tabular-nums">{h.porCertificacion ? '—' : fecha(h.fechaVencimiento)}</td>
                      <td className="fk-num">{$(h.importe)}</td>
                      <td className="fk-num">
                        {Number(h.pendiente) === 0 ? (
                          <Etiqueta tono="ok">Cobrado</Etiqueta>
                        ) : (
                          <span className={h.vencido ? 'font-semibold text-fk-error-texto' : ''}>{$(h.pendiente)}</span>
                        )}
                      </td>
                      <td className="text-right">
                        {h.porCertificacion && Number(h.aCertificar) > 0 && (
                          <Boton variante="fantasma" onClick={() => setModal({ tipo: 'certificar', hito: h })}>
                            Certificar
                          </Boton>
                        )}
                      </td>
                    </tr>
                    {h.certificaciones.map((c) => (
                      <tr key={c.id} className="text-sm">
                        <td className="pl-8 text-fk-gris-texto">
                          {fecha(c.fecha)} · {c.descripcion}
                        </td>
                        <td className={`tabular-nums ${c.vencido ? 'font-semibold text-fk-error-texto' : ''}`}>{fecha(c.fechaVencimiento)}</td>
                        <td className="fk-num">{$(c.importe)}</td>
                        <td className="fk-num">{Number(c.pendiente) === 0 ? <Etiqueta tono="ok">Cobrado</Etiqueta> : $(c.pendiente)}</td>
                        <td className="text-right">
                          <BotonIcono etiqueta="Quitar certificación" icono={Trash2} peligro onClick={() => quitarCertificacion.mutate(c.id)} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </ContenedorTabla>
        )}
      </Tarjeta>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Tarjeta
          titulo="Adicionales y facturas"
          acciones={
            <Boton variante="terciario" onClick={() => setModal({ tipo: 'adicional' })}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Adicional
            </Boton>
          }
        >
          {p.cargos.length === 0 && p.notasCredito.length === 0 ? (
            <Vacio>Sin adicionales ni facturas.</Vacio>
          ) : (
            <ContenedorTabla>
              <table className="fk-tabla">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Fecha</th>
                    <th className="fk-num">Importe</th>
                    <th className="fk-num">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {p.cargos.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.comprobanteId ? (
                          <Link to={`/comprobantes/${c.comprobanteId}`} className="font-medium text-fk-fiordo hover:underline">
                            {c.concepto} {c.numero}
                          </Link>
                        ) : (
                          <span className="font-medium">{c.concepto}</span>
                        )}
                        {c.observaciones && <span className="block text-xs text-fk-gris-texto">{c.observaciones}</span>}
                      </td>
                      <td className="tabular-nums">{fecha(c.fecha)}</td>
                      <td className="fk-num">{$(c.importe)}</td>
                      <td className={`fk-num ${c.vencido ? 'font-semibold text-fk-error-texto' : ''}`}>{$(c.pendiente)}</td>
                    </tr>
                  ))}
                  {p.notasCredito.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <Link to={`/comprobantes/${n.comprobanteId}`} className="font-medium text-fk-fiordo hover:underline">
                          {n.concepto} {n.numero}
                        </Link>
                      </td>
                      <td className="tabular-nums">{fecha(n.fecha)}</td>
                      <td className="fk-num">−{$(n.importe)}</td>
                      <td className="fk-num">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ContenedorTabla>
          )}
        </Tarjeta>

        <Tarjeta titulo="Entregas">
          {p.entregas.length === 0 ? (
            <Vacio
              accion={
                p.estado !== 'CANCELADO' && (
                  <Boton variante="terciario" onClick={() => setModal({ tipo: 'entrega' })}>
                    Registrar la primera entrega
                  </Boton>
                )
              }
            >
              Todavía no hay entregas en esta {etiquetaMin}.
            </Vacio>
          ) : (
            <ContenedorTabla>
              <table className="fk-tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Comprobante</th>
                    <th>Detalle</th>
                    <th className="fk-num">Importe</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {p.entregas.map((e) => (
                    <tr key={e.id} className={e.anulado ? 'text-fk-gris-texto line-through' : ''}>
                      <td className="tabular-nums">{fecha(e.fecha)}</td>
                      <td>
                        {e.reciboId ? (
                          <Link to={`/comprobantes/recibos/${e.reciboId}`} className="font-medium text-fk-fiordo hover:underline">
                            Recibo {e.numero}
                          </Link>
                        ) : (
                          e.concepto
                        )}
                        {e.anulado && (
                          <Etiqueta tono="info" tachado className="ml-2">
                            Anulado
                          </Etiqueta>
                        )}
                      </td>
                      <td className="text-sm text-fk-gris-texto">
                        {e.monedaOrigen && e.importeOrigen ? `${dinero(e.importeOrigen, e.monedaOrigen)} a TC ${dinero(e.tipoCambio ?? 0)}` : ''}
                        {e.observaciones ? `${e.monedaOrigen ? ' · ' : ''}${e.observaciones}` : ''}
                        {Number(e.aCuenta) > 0 && !e.anulado ? ` · ${$(e.aCuenta)} a cuenta` : ''}
                      </td>
                      <td className="fk-num">{$(e.importe)}</td>
                      <td className="text-right">
                        {e.reciboId && <BotonIcono etiqueta="Ver PDF del recibo" icono={FileText} onClick={() => void verRecibo(e.reciboId!)} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ContenedorTabla>
          )}
        </Tarjeta>
      </div>

      {sinMovimientos && (
        <div className="flex justify-end">
          <Boton
            variante="destructivo"
            cargando={eliminar.isPending}
            onClick={() => window.confirm(`¿Eliminar esta ${etiquetaMin}?`) && eliminar.mutate()}
          >
            Eliminar {etiqueta.toLowerCase()}
          </Boton>
        </div>
      )}

      {modal?.tipo === 'entrega' && <EntregaModal proyecto={p} onCerrar={() => setModal(null)} onRecibo={(r) => void verRecibo(r)} />}
      {modal?.tipo === 'adicional' && <AdicionalModal proyecto={p} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'plan' && <PlanModal proyecto={p} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'datos' && <DatosProyectoModal proyecto={p} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'certificar' && <CertificacionModal proyecto={p} hito={modal.hito} onCerrar={() => setModal(null)} />}
    </div>
  );
}
