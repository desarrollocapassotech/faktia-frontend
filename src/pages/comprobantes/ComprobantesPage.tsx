import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Eye, FileMinus, FilePlus, FileText, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertaError,
  Boton,
  BotonIcono,
  Cargando,
  ContenedorTabla,
  EncabezadoPagina,
  EtiquetaEstado,
  EtiquetaPrueba,
  Modal,
  Selector,
  Tarjeta,
  Vacio,
} from '@/components/ui';
import { dinero, esFactura, ESTADOS, fecha, numeroComprobante, tipoLargo } from '@/lib/formato';
import type { Comprobante, ComprobanteResumen, EstadoComprobante, Paginado } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { EmitirModal, NotaModal, type ClaseNota } from './modalesComprobante';

const POR_PAGINA = 25;

type Accion = { tipo: 'emitir'; id: string } | { tipo: 'nota'; clase: ClaseNota; comprobante: ComprobanteResumen };

export function ComprobantesPage() {
  const { pedir, verEnPestana } = useApi();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoComprobante | ''>('');
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [errorAccion, setErrorAccion] = useState<unknown>(null);

  async function verPdf(id: string) {
    setErrorAccion(null);
    try {
      await verEnPestana(`/comprobantes/${id}/pdf`);
    } catch (err) {
      setErrorAccion(err);
    }
  }

  const { data, error, isFetching } = useQuery({
    queryKey: ['comprobantes', { estado, pagina }],
    queryFn: () => {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
      if (estado) params.set('estado', estado);
      return pedir<Paginado<ComprobanteResumen>>(`/comprobantes?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div className="space-y-8">
      <EncabezadoPagina titulo="Comprobantes" tituloEnBarra />
      <Tarjeta>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Selector
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as EstadoComprobante | '');
              setPagina(1);
            }}
            className="max-w-xs"
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([v, { texto }]) => (
              <option key={v} value={v}>
                {texto}
              </option>
            ))}
          </Selector>
          {isFetching && <span className="text-xs text-fk-gris-texto">Actualizando…</span>}
          <Boton className="ml-auto" onClick={() => navigate('/comprobantes/nuevo')}>
            Nueva factura
          </Boton>
        </div>
        {errorAccion != null && (
          <div className="mb-4">
            <AlertaError error={errorAccion} />
          </div>
        )}
        {error ? (
          <AlertaError error={error} />
        ) : !data ? (
          <Cargando />
        ) : data.items.length === 0 ? (
          estado ? (
            <Vacio>No hay comprobantes en ese estado.</Vacio>
          ) : (
            <Vacio accion={<Boton onClick={() => navigate('/comprobantes/nuevo')}>Nueva factura</Boton>}>Todavía no hay comprobantes.</Vacio>
          )
        ) : (
          <>
            <ContenedorTabla>
              <table className="fk-tabla">
                <thead>
                  <tr>
                    <th>Comprobante</th>
                    <th className="fk-num">Número</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th className="fk-num">Total</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap">
                        <Link to={`/comprobantes/${c.id}`} className="font-medium text-fk-fiordo underline-offset-2 hover:underline">
                          {tipoLargo(c.tipo)}
                        </Link>
                      </td>
                      <td className="fk-num">{numeroComprobante(c.puntoVenta.numero, c.numero)}</td>
                      <td className="whitespace-nowrap tabular-nums">{fecha(c.fechaEmision)}</td>
                      <td>{c.cliente.razonSocial}</td>
                      <td className="fk-num">{dinero(c.importeTotal, c.moneda)}</td>
                      <td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <EtiquetaEstado estado={ESTADOS[c.estado]} />
                          <EtiquetaPrueba ambiente={c.ambiente} soloIcono />
                        </span>
                      </td>
                      <td className="py-1">
                        <div className="flex justify-end gap-1">
                          <BotonIcono etiqueta="Ver detalle" icono={Eye} onClick={() => navigate(`/comprobantes/${c.id}`)} />
                          <BotonIcono
                            etiqueta={c.estado === 'RECHAZADO' ? 'Volver a emitir' : 'Volver a emitir (solo rechazados)'}
                            icono={RotateCw}
                            disabled={c.estado !== 'RECHAZADO'}
                            onClick={() => setAccion({ tipo: 'emitir', id: c.id })}
                          />
                          <BotonIcono
                            etiqueta={puedeNota(c) ? 'Emitir nota de crédito' : 'Nota de crédito (solo facturas emitidas)'}
                            icono={FileMinus}
                            disabled={!puedeNota(c)}
                            onClick={() => setAccion({ tipo: 'nota', clase: 'NOTA_CREDITO', comprobante: c })}
                          />
                          <BotonIcono
                            etiqueta={puedeNota(c) ? 'Emitir nota de débito' : 'Nota de débito (solo facturas emitidas)'}
                            icono={FilePlus}
                            disabled={!puedeNota(c)}
                            onClick={() => setAccion({ tipo: 'nota', clase: 'NOTA_DEBITO', comprobante: c })}
                          />
                          <BotonIcono
                            etiqueta={tienePdf(c) ? 'Ver PDF' : 'PDF (solo comprobantes autorizados)'}
                            icono={FileText}
                            disabled={!tienePdf(c)}
                            onClick={() => void verPdf(c.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ContenedorTabla>
            {paginas > 1 && (
              <div className="mt-5 flex items-center justify-end gap-3 text-sm">
                <Boton variante="terciario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Boton>
                <span className="text-fk-gris-texto tabular-nums">
                  Página {data.pagina} de {paginas}
                </span>
                <Boton variante="terciario" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </Boton>
              </div>
            )}
          </>
        )}
      </Tarjeta>

      {accion?.tipo === 'emitir' && <ReemitirDesdeLista id={accion.id} onCerrar={() => setAccion(null)} />}
      {accion?.tipo === 'nota' && <NotaModal factura={accion.comprobante} clase={accion.clase} onCerrar={() => setAccion(null)} />}
    </div>
  );
}

function puedeNota(c: ComprobanteResumen) {
  return esFactura(c.tipo) && c.estado === 'EMITIDO';
}

function tienePdf(c: ComprobanteResumen) {
  return Boolean(c.cae) && (c.estado === 'EMITIDO' || c.estado === 'ANULADO');
}

/** El listado no trae la versión ni la advertencia de letra: se pide el comprobante completo antes de confirmar. */
function ReemitirDesdeLista({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const { data, error } = useQuery({
    queryKey: ['comprobante', id],
    queryFn: () => pedir<Comprobante>(`/comprobantes/${id}`),
  });

  if (error) {
    return (
      <Modal abierto titulo="Volver a emitir" onCerrar={onCerrar}>
        <AlertaError error={error} />
      </Modal>
    );
  }
  if (!data) {
    return (
      <Modal abierto titulo="Volver a emitir" onCerrar={onCerrar}>
        <Cargando />
      </Modal>
    );
  }
  // Si no quedó emitido (rechazo de ARCA o respuesta pendiente), el detalle es donde se ve qué pasó.
  const alDetalle = () => navigate(`/comprobantes/${id}`);
  return (
    <EmitirModal
      comprobante={data}
      onCerrar={onCerrar}
      onActualizado={(n) => {
        if (n.estado !== 'EMITIDO') alDetalle();
      }}
      onRechazado={alDetalle}
    />
  );
}
