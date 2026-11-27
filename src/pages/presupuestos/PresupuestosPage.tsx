import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CircleCheck, CircleX, Clock, FilePen, Layers, Plus, Send, type LucideIcon } from 'lucide-react';
import { claseBoton } from '@/components/estilos';
import { AlertaError, Cargando, ContenedorTabla, EncabezadoPagina, Entrada, EtiquetaEstado, Tarjeta, Vacio } from '@/components/ui';
import { dinero, ESTADOS_PRESUPUESTO, fecha } from '@/lib/formato';
import type { EstadoPresupuesto, PresupuestoResumen } from '@/lib/tipos';
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

/** Presupuestos: historial ordenado por número, con filtros por estado y búsqueda. */
export function PresupuestosPage() {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const q = useDeferredValue(busqueda.trim());
  const parametros = new URLSearchParams({ ...(filtro !== 'TODOS' ? { estado: filtro } : {}), ...(q ? { q } : {}) }).toString();
  const { data, error, isLoading } = useQuery({
    queryKey: ['presupuestos', parametros],
    queryFn: () => pedir<PresupuestoResumen[]>(`/presupuestos${parametros ? `?${parametros}` : ''}`),
  });

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
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Trabajo</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th className="fk-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/presupuestos/${p.id}`)}>
                    <td className="tabular-nums">
                      <Link to={`/presupuestos/${p.id}`} className="font-semibold text-fk-fiordo hover:underline" onClick={(e) => e.stopPropagation()}>
                        {p.numero}
                      </Link>
                    </td>
                    <td className="tabular-nums">{fecha(p.fecha)}</td>
                    <td>{p.cliente.razonSocial}</td>
                    <td>
                      {p.titulo ?? '—'}
                      {p.lugar && <span className="block text-xs text-fk-gris-texto">{p.lugar}</span>}
                    </td>
                    <td className="tabular-nums">{fecha(p.fechaVencimiento)}</td>
                    <td>
                      <EtiquetaEstado estado={ESTADOS_PRESUPUESTO[p.estado]} />
                    </td>
                    <td className="fk-num">{dinero(p.total, p.moneda)}</td>
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
