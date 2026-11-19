import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Eye, FileMinus, FilePlus, FileText, Plus, RotateCw, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertaError,
  Boton,
  BotonIcono,
  Campo,
  Cargando,
  ContenedorTabla,
  EncabezadoPagina,
  Entrada,
  EtiquetaEstado,
  EtiquetaPrueba,
  FiltrosAplicados,
  Modal,
  Selector,
  SelectorBuscable,
  Tarjeta,
  TituloOrdenable,
  Vacio,
  type FiltroAplicado,
} from '@/components/ui';
import { dinero, esFactura, ESTADOS, fecha, numeroComprobante, tipoLargo } from '@/lib/formato';
import { useOrdenColumna } from '@/lib/orden';
import type { Cliente, Comprobante, ComprobanteResumen, FilaComprobantes, Paginado } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { EmitirModal, NotaModal, type ClaseNota } from './modalesComprobante';

const POR_PAGINA = 25;
/** Mismo formato que acepta el backend: "15" o "00002-00000015". */
const NUMERO_VALIDO = /^\s*\d{1,8}(\s*-\s*\d{1,8})?\s*$/;

/** Filtro por tipo, cualquier letra. Espejo de `CLASES_COMPROBANTE` del backend (más RECIBO). */
type ClaseFiltro = 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'RECIBO';
const CLASES_FILTRO: Array<{ value: ClaseFiltro; label: string }> = [
  { value: 'FACTURA', label: 'Factura' },
  { value: 'NOTA_CREDITO', label: 'Nota de crédito' },
  { value: 'NOTA_DEBITO', label: 'Nota de débito' },
  { value: 'RECIBO', label: 'Recibo' },
];

const TIPOS_RECIBO = { RECIBO_COBRO: 'Recibo de cobro', RECIBO_PAGO: 'Recibo de pago' } as const;

function tipoFila(f: FilaComprobantes): string {
  return f.clase === 'recibo' ? TIPOS_RECIBO[f.tipo] : tipoLargo(f.tipo);
}

function numeroFila(f: FilaComprobantes): string {
  return f.clase === 'recibo' ? (f.numeroTexto ?? '—') : numeroComprobante(f.puntoVenta.numero, f.numero);
}

function rutaDetalle(f: FilaComprobantes): string {
  return f.clase === 'recibo' ? `/comprobantes/recibos/${f.id}` : `/comprobantes/${f.id}`;
}

/** Ruta del PDF: los recibos se regeneran desde lo guardado. */
function rutaPdf(f: FilaComprobantes): string {
  return f.clase === 'recibo' ? `/recibos/${f.id}/pdf` : `/comprobantes/${f.id}/pdf`;
}

/** Columnas ordenables. Espejo de `ORDENES_COMPROBANTES` del backend. */
type OrdenComprobantes = 'comprobante' | 'numero' | 'fecha' | 'cliente' | 'total' | 'estado';

type AccionFila = {
  id: string;
  texto: string;
  /** Tooltip del ícono deshabilitado: cuándo se puede usar. */
  noDisponible: string;
  icono: LucideIcon;
  disponible: boolean;
  ejecutar: () => void;
};

type Accion ={ tipo: 'emitir'; id: string } | { tipo: 'nota'; clase: ClaseNota; comprobante: ComprobanteResumen };

export function ComprobantesPage() {
  const { pedir, verEnPestana } = useApi();
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);
  const [clase, setClase] = useState<ClaseFiltro | ''>('');
  const [numero, setNumero] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [clienteId, setClienteId] = useState('');
  const { orden, ordenColumna } = useOrdenColumna<OrdenComprobantes>(() => setPagina(1), {
    numero: 'numero',
    fecha: 'fecha',
    total: 'numero',
  });
  const [accion, setAccion] = useState<Accion | null>(null);
  // Fila clickeada: modal con todas sus acciones disponibles.
  const [menu, setMenu] = useState<FilaComprobantes | null>(null);

  /** Acciones de una fila: las mismas en los íconos de la columna y en el modal. Los recibos: detalle y PDF. */
  function accionesDe(f: FilaComprobantes): AccionFila[] {
    const c = f.clase === 'comprobante' ? f : null;
    return [
      { id: 'ver', texto: 'Ver detalle', noDisponible: '', icono: Eye, disponible: true, ejecutar: () => navigate(rutaDetalle(f)) },
      {
        id: 'reemitir',
        texto: 'Volver a emitir',
        noDisponible: 'Volver a emitir (solo rechazados)',
        icono: RotateCw,
        disponible: c?.estado === 'RECHAZADO',
        ejecutar: () => setAccion({ tipo: 'emitir', id: f.id }),
      },
      {
        id: 'nc',
        texto: 'Emitir nota de crédito',
        noDisponible: 'Nota de crédito (solo facturas emitidas)',
        icono: FileMinus,
        disponible: Boolean(c && puedeNota(c)),
        ejecutar: () => c && setAccion({ tipo: 'nota', clase: 'NOTA_CREDITO', comprobante: c }),
      },
      {
        id: 'nd',
        texto: 'Emitir nota de débito',
        noDisponible: 'Nota de débito (solo facturas emitidas)',
        icono: FilePlus,
        disponible: Boolean(c && puedeNota(c)),
        ejecutar: () => c && setAccion({ tipo: 'nota', clase: 'NOTA_DEBITO', comprobante: c }),
      },
      {
        id: 'pdf',
        texto: 'Ver PDF',
        noDisponible: 'PDF (solo comprobantes autorizados)',
        icono: FileText,
        disponible: !c || tienePdf(c),
        ejecutar: () => void verPdf(f),
      },
    ];
  }

  // El número se busca al dejar de tipear, y solo si tiene forma de número ("15" o "00002-00000015").
  const [numeroBuscado, setNumeroBuscado] = useState('');
  useEffect(() => {
    const valido = NUMERO_VALIDO.test(numero) ? numero.trim() : '';
    if (valido === numeroBuscado) return;
    const t = setTimeout(() => {
      setNumeroBuscado(valido);
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [numero, numeroBuscado]);
  const numeroInvalido = numero.trim() !== '' && !NUMERO_VALIDO.test(numero);

  const clientes = useQuery({
    queryKey: ['clientes', { q: '', inactivos: true }],
    queryFn: () => pedir<Cliente[]>('/clientes?incluirInactivos=true'),
  });

  const opcionesClientes = useMemo(
    () =>
      (clientes.data ?? [])
        .map((cl) => ({ value: cl.id, label: cl.activo ? cl.razonSocial : `${cl.razonSocial} (inactivo)` }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })),
    [clientes.data],
  );

  // Mismo orden que los campos: tipo, número, cliente, desde, hasta.
  const filtrosAplicados: FiltroAplicado[] = [];
  if (clase) {
    filtrosAplicados.push({
      id: 'clase',
      titulo: 'Tipo',
      valor: CLASES_FILTRO.find((c) => c.value === clase)?.label ?? clase,
      quitar: () => (setClase(''), setPagina(1)),
    });
  }
  if (numeroBuscado) {
    filtrosAplicados.push({
      id: 'numero',
      titulo: 'Número',
      valor: numeroBuscado,
      quitar: () => {
        setNumero('');
        setNumeroBuscado('');
        setPagina(1);
      },
    });
  }
  if (clienteId) {
    filtrosAplicados.push({
      id: 'cliente',
      titulo: 'Cliente',
      valor: opcionesClientes.find((o) => o.value === clienteId)?.label ?? 'Cliente',
      quitar: () => (setClienteId(''), setPagina(1)),
    });
  }
  if (fechaDesde) {
    filtrosAplicados.push({ id: 'desde', titulo: 'Desde', valor: fecha(fechaDesde), quitar: () => (setFechaDesde(''), setPagina(1)) });
  }
  if (fechaHasta) {
    filtrosAplicados.push({ id: 'hasta', titulo: 'Hasta', valor: fecha(fechaHasta), quitar: () => (setFechaHasta(''), setPagina(1)) });
  }
  const hayFiltros = filtrosAplicados.length > 0;

  function limpiarFiltros() {
    setClase('');
    setNumero('');
    setNumeroBuscado('');
    setFechaDesde('');
    setFechaHasta('');
    setClienteId('');
    setPagina(1);
  }
  const [errorAccion, setErrorAccion] = useState<unknown>(null);

  async function verPdf(f: FilaComprobantes) {
    setErrorAccion(null);
    try {
      await verEnPestana(rutaPdf(f));
    } catch (err) {
      setErrorAccion(err);
    }
  }

  const { data, error, isFetching } = useQuery({
    queryKey: ['comprobantes', { pagina, clase, numeroBuscado, fechaDesde, fechaHasta, clienteId, orden }],
    queryFn: () => {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA), incluirRecibos: 'true' });
      if (clase) params.set('clase', clase);
      if (numeroBuscado) params.set('numero', numeroBuscado);
      if (fechaDesde) params.set('fechaDesde', fechaDesde);
      if (fechaHasta) params.set('fechaHasta', fechaHasta);
      if (clienteId) params.set('clienteId', clienteId);
      if (orden) {
        params.set('ordenarPor', orden.por);
        params.set('dir', orden.dir);
      }
      return pedir<Paginado<FilaComprobantes>>(`/comprobantes?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div className="space-y-8">
      <EncabezadoPagina titulo="Comprobantes" tituloEnBarra />
      <Tarjeta>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <Campo etiqueta="Tipo" className="w-44">
            <Selector
              value={clase}
              onChange={(e) => {
                setClase(e.target.value as ClaseFiltro | '');
                setPagina(1);
              }}
            >
              <option value="">Todos</option>
              {CLASES_FILTRO.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Número" className="w-44" error={numeroInvalido ? 'Ej.: 15 o 00002-00000015' : null}>
            <Entrada
              type="search"
              inputMode="numeric"
              placeholder="00002-00000015"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              aria-invalid={numeroInvalido}
            />
          </Campo>
          <Campo etiqueta="Cliente" className="w-64">
            <SelectorBuscable
              value={clienteId}
              onChange={(v) => {
                setClienteId(v);
                setPagina(1);
              }}
              opciones={opcionesClientes}
              placeholder="Todos los clientes"
              placeholderBusqueda="Buscar cliente…"
            />
          </Campo>
          <Campo etiqueta="Desde" className="w-40">
            <Entrada
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPagina(1);
              }}
            />
          </Campo>
          <Campo etiqueta="Hasta" className="w-40">
            <Entrada
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPagina(1);
              }}
            />
          </Campo>
          {isFetching && <span className="self-center text-xs text-fk-gris-texto">Actualizando…</span>}
          <Boton className="ml-auto" onClick={() => navigate('/comprobantes/nuevo')}>
            <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            Nuevo comprobante
          </Boton>
        </div>
        {filtrosAplicados.length > 0 && (
          <div className="mb-5">
            <FiltrosAplicados filtros={filtrosAplicados} onLimpiar={limpiarFiltros} />
          </div>
        )}
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
          hayFiltros ? (
            <Vacio accion={<Boton variante="terciario" onClick={limpiarFiltros}>Limpiar filtros</Boton>}>
              No hay comprobantes con esos filtros.
            </Vacio>
          ) : (
            <Vacio accion={<Boton onClick={() => navigate('/comprobantes/nuevo')}>Nuevo comprobante</Boton>}>Todavía no hay comprobantes.</Vacio>
          )
        ) : (
          <>
            <ContenedorTabla>
              <table className="fk-tabla">
                <thead>
                  <tr>
                    <th>
                      <TituloOrdenable titulo="Comprobante" orden={ordenColumna('comprobante')} />
                    </th>
                    <th className="fk-num">
                      <TituloOrdenable titulo="Número" orden={ordenColumna('numero')} />
                    </th>
                    <th>
                      <TituloOrdenable titulo="Fecha" orden={ordenColumna('fecha')} />
                    </th>
                    <th>
                      <TituloOrdenable titulo="Cliente" orden={ordenColumna('cliente')} />
                    </th>
                    <th className="fk-num">
                      <TituloOrdenable titulo="Total" orden={ordenColumna('total')} />
                    </th>
                    <th>
                      <TituloOrdenable titulo="Estado" orden={ordenColumna('estado')} />
                    </th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setMenu(c)}
                      title="Click para ver las acciones"
                      className="cursor-pointer transition-colors hover:bg-fk-niebla/50"
                    >
                      <td className="whitespace-nowrap">
                        <Link
                          to={rutaDetalle(c)}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-fk-fiordo underline-offset-2 hover:underline"
                        >
                          {tipoFila(c)}
                        </Link>
                      </td>
                      <td className="fk-num">{numeroFila(c)}</td>
                      <td className="whitespace-nowrap tabular-nums">{fecha(c.fechaEmision)}</td>
                      <td>{c.cliente.razonSocial}</td>
                      <td className="fk-num">{dinero(c.importeTotal, c.moneda)}</td>
                      <td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <EtiquetaEstado estado={ESTADOS[c.estado]} />
                          <EtiquetaPrueba ambiente={c.ambiente ?? ''} soloIcono />
                        </span>
                      </td>
                      {/* Los íconos hacen su acción; no abren el modal de la fila. */}
                      <td className="py-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {accionesDe(c).map((a) => (
                            <BotonIcono
                              key={a.id}
                              etiqueta={a.disponible ? a.texto : a.noDisponible}
                              icono={a.icono}
                              disabled={!a.disponible}
                              onClick={a.ejecutar}
                            />
                          ))}
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

      {menu && (
        <Modal abierto titulo={`${tipoFila(menu)} ${numeroFila(menu)}`} onCerrar={() => setMenu(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fk-gris-texto">
              <span className="font-medium text-fk-grafito">{menu.cliente.razonSocial}</span>
              <span className="tabular-nums">{fecha(menu.fechaEmision)}</span>
              <span className="tabular-nums">{dinero(menu.importeTotal, menu.moneda)}</span>
              <EtiquetaEstado estado={ESTADOS[menu.estado]} />
              <EtiquetaPrueba ambiente={menu.ambiente ?? ''} />
            </div>
            <ul className="divide-y divide-fk-borde overflow-hidden rounded-fk border border-fk-borde">
              {accionesDe(menu)
                .filter((a) => a.disponible)
                .map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(null);
                        a.ejecutar();
                      }}
                      className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium text-fk-grafito transition-colors hover:bg-fk-niebla"
                    >
                      <a.icono className="h-[18px] w-[18px] shrink-0 text-fk-fiordo" strokeWidth={1.75} aria-hidden />
                      {a.texto}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </Modal>
      )}
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
