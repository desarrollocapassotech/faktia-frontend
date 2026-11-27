import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CircleCheck, CircleX, Clock, Copy, Eye, FilePen, FileText, Layers, Pencil, Plus, Send, type LucideIcon } from 'lucide-react';
import { claseBoton } from '@/components/estilos';
import { AlertaError, BotonIcono, Cargando, ContenedorTabla, EncabezadoPagina, Entrada, EtiquetaEstado, Tarjeta, TituloOrdenable, Vacio } from '@/components/ui';
import { dinero, ESTADOS_PRESUPUESTO, fecha } from '@/lib/formato';
import { useEmpresa } from '@/lib/modulos';
import { useOrdenColumna, type OrdenDir } from '@/lib/orden';
import { confirmarCambioEstado, confirmarDuplicado } from '@/pages/presupuestos/confirmaciones';
import type { EstadoPresupuesto, PresupuestoResumen } from '@/lib/tipos';
import { toast } from '@/lib/toasts';
import { useApi } from '@/lib/useApi';

type Filtro = EstadoPresupuesto | 'TODOS';
const FILTROS: Array<{ id: Filtro; texto: string; icono: LucideIcon }> = [
  { id: 'TODOS', texto: 'Todos', icono: Layers },
  { id: 'BORRADOR', texto: 'Borradores', icono: FilePen },
  { id: 'ENVIADO', texto: 'Enviados', icono: Send },
  { id: 'ACEPTADO', texto: 'Aceptados', icono: CircleCheck },
  { id: 'RECHAZADO', texto: 'Rechazados', icono: CircleX },
  { id: 'VENCIDO', texto: 'Vencidos', icono: Clock },
];

type OrdenPresupuestos = 'numero' | 'fecha' | 'cliente' | 'trabajo' | 'lugar' | 'estado' | 'total';
const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/** Orden por columna, en el navegador (la lista ya viene filtrada del backend). Los vacíos van al final. */
function ordenarPresupuestos(lista: PresupuestoResumen[], orden: { por: OrdenPresupuestos; dir: OrdenDir } | null) {
  if (!orden) return lista;
  const signo = orden.dir === 'asc' ? 1 : -1;
  const valor = (p: PresupuestoResumen): string | number | null => {
    switch (orden.por) {
      case 'numero':
        return p.numero;
      case 'fecha':
        return p.fecha;
      case 'cliente':
        return p.cliente.razonSocial;
      case 'trabajo':
        return p.titulo;
      case 'lugar':
        return p.lugar;
      case 'estado':
        return ESTADOS_PRESUPUESTO[p.estado].texto;
      case 'total':
        return Number(p.total);
    }
  };
  return [...lista].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    const comparacion = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
    return signo * comparacion || collator.compare(b.numero, a.numero);
  });
}

type CambioEstado = 'ENVIADO' | 'ACEPTADO' | 'RECHAZADO';
const MENSAJES_ESTADO: Record<CambioEstado, string> = {
  ENVIADO: 'Presupuesto marcado como enviado.',
  ACEPTADO: 'Presupuesto aceptado.',
  RECHAZADO: 'Presupuesto rechazado.',
};

/**
 * Acciones por fila. Siempre están los seis íconos (las filas quedan alineadas); los cambios de estado
 * que no corresponden quedan deshabilitados, con las mismas reglas que el detalle del presupuesto.
 */
function AccionesFila({ presupuesto: p }: { presupuesto: PresupuestoResumen }) {
  const { pedir, verEnPestana } = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
    void queryClient.invalidateQueries({ queryKey: ['presupuesto', p.id] });
  };

  const estado = useMutation({
    meta: { error: 'No se pudo cambiar el estado.' },
    mutationFn: (e: CambioEstado) => pedir(`/presupuestos/${p.id}/estado`, 'PATCH', { estado: e }),
    onSuccess: (_r, e) => {
      toast.exito(MENSAJES_ESTADO[e], p.numero);
      refrescar();
    },
  });
  const duplicar = useMutation({
    meta: { exito: 'Presupuesto duplicado.', error: 'No se pudo duplicar el presupuesto.' },
    mutationFn: () => pedir<{ id: string }>(`/presupuestos/${p.id}/duplicar`, 'POST', { reemplaza: false }),
    onSuccess: (nuevo) => {
      refrescar();
      navigate(`/presupuestos/${nuevo.id}`);
    },
  });

  async function verPdf() {
    try {
      await verEnPestana(`/presupuestos/${p.id}/pdf`);
    } catch (err) {
      toast.error('No se pudo abrir el PDF.', err instanceof Error ? err.message : undefined);
    }
  }

  const conProyecto = Boolean(p.proyectoId);
  const decidible = !conProyecto && ['BORRADOR', 'ENVIADO', 'VENCIDO'].includes(p.estado);
  const borrador = p.estado === 'BORRADOR';
  const cargando = (e: CambioEstado) => estado.isPending && estado.variables === e;
  const cambiar = async (e: CambioEstado) => (await confirmarCambioEstado(p.numero, e)) && estado.mutate(e);

  return (
    <div className="flex justify-end gap-1">
      <BotonIcono etiqueta={borrador ? 'Editar' : 'Ver'} icono={borrador ? Pencil : Eye} onClick={() => navigate(`/presupuestos/${p.id}`)} />
      <BotonIcono etiqueta="Ver PDF" icono={FileText} onClick={() => void verPdf()} />
      <BotonIcono etiqueta="Marcar como enviado" icono={Send} disabled={!borrador || conProyecto || estado.isPending} cargando={cargando('ENVIADO')} onClick={() => void cambiar('ENVIADO')} />
      <BotonIcono etiqueta="Marcar como aceptado" icono={CircleCheck} disabled={!decidible || estado.isPending} cargando={cargando('ACEPTADO')} onClick={() => void cambiar('ACEPTADO')} />
      <BotonIcono etiqueta="Marcar como rechazado" icono={CircleX} peligro disabled={!decidible || estado.isPending} cargando={cargando('RECHAZADO')} onClick={() => void cambiar('RECHAZADO')} />
      <BotonIcono etiqueta="Duplicar" icono={Copy} cargando={duplicar.isPending} onClick={async () => (await confirmarDuplicado(p.numero)) && duplicar.mutate()} />
    </div>
  );
}

/** Presupuestos: historial ordenado por número, con filtros por estado y búsqueda. */
export function PresupuestosPage() {
  const { pedir } = useApi();
  const { etiqueta } = useEmpresa();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const q = useDeferredValue(busqueda.trim());
  const parametros = new URLSearchParams({ ...(filtro !== 'TODOS' ? { estado: filtro } : {}), ...(q ? { q } : {}) }).toString();
  const { data, error, isLoading } = useQuery({
    queryKey: ['presupuestos', parametros],
    queryFn: () => pedir<PresupuestoResumen[]>(`/presupuestos${parametros ? `?${parametros}` : ''}`),
  });
  const { orden, ordenColumna } = useOrdenColumna<OrdenPresupuestos>(undefined, { numero: 'numero', fecha: 'fecha', total: 'numero' });
  const ordenados = useMemo(() => ordenarPresupuestos(data ?? [], orden), [data, orden]);

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Presupuestos"
        tituloEnBarra
        acciones={
          <>
            <Link to="/presupuestos/biblioteca" className={claseBoton('terciario')}>
              <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Biblioteca
            </Link>
            <Link to="/presupuestos/nuevo" className={claseBoton('primario')}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Nuevo presupuesto
            </Link>
          </>
        }
      />
      <Tarjeta>
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div role="tablist" aria-label="Estado" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                role="tab"
                type="button"
                aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-fk px-3 text-sm whitespace-nowrap transition-colors ${
                  filtro === f.id ? 'bg-fk-niebla font-semibold text-fk-fiordo' : 'font-medium text-fk-gris-texto hover:bg-fk-niebla/60 hover:text-fk-grafito'
                }`}
              >
                <f.icono className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {f.texto}
              </button>
            ))}
          </div>
          <Entrada type="search" placeholder="Buscar por número, cliente, trabajo o lugar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
        </div>
        <AlertaError error={error} />
        {isLoading ? (
          <Cargando />
        ) : !data?.length ? (
          <Vacio
            accion={
              <Link to="/presupuestos/nuevo" className={claseBoton('terciario')}>
                Armar un presupuesto
              </Link>
            }
          >
            {q || filtro !== 'TODOS' ? 'No hay presupuestos con ese filtro.' : 'Todavía no armaste ningún presupuesto.'}
          </Vacio>
        ) : (
          <ContenedorTabla>
            <table className="fk-tabla">
              <thead>
                <tr>
                  <th>
                    <TituloOrdenable titulo="Número" orden={ordenColumna('numero')} />
                  </th>
                  <th>
                    <TituloOrdenable titulo="Fecha" orden={ordenColumna('fecha')} />
                  </th>
                  <th>
                    <TituloOrdenable titulo="Cliente" orden={ordenColumna('cliente')} />
                  </th>
                  <th>
                    <TituloOrdenable titulo="Trabajo" orden={ordenColumna('trabajo')} />
                  </th>
                  <th>
                    <TituloOrdenable titulo={`${etiqueta} o lugar`} orden={ordenColumna('lugar')} />
                  </th>
                  <th>
                    <TituloOrdenable titulo="Estado" orden={ordenColumna('estado')} />
                  </th>
                  <th className="fk-num">
                    <TituloOrdenable titulo="Total" orden={ordenColumna('total')} />
                  </th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {ordenados.map((p) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/presupuestos/${p.id}`)}>
                    <td className="tabular-nums">
                      <Link to={`/presupuestos/${p.id}`} className="font-semibold text-fk-fiordo hover:underline" onClick={(e) => e.stopPropagation()}>
                        {p.numero}
                      </Link>
                    </td>
                    <td className="tabular-nums">{fecha(p.fecha)}</td>
                    <td>{p.cliente.razonSocial}</td>
                    <td>{p.titulo ?? '—'}</td>
                    <td>{p.lugar ?? '—'}</td>
                    <td>
                      <EtiquetaEstado estado={ESTADOS_PRESUPUESTO[p.estado]} />
                    </td>
                    <td className="fk-num">{dinero(p.total, p.moneda)}</td>
                    <td className="py-1" onClick={(e) => e.stopPropagation()}>
                      <AccionesFila presupuesto={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ContenedorTabla>
        )}
      </Tarjeta>
    </div>
  );
}
