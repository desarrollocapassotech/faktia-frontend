import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleCheck, CircleSlash, HardHat, Layers, Plus, type LucideIcon } from 'lucide-react';
import { claseBoton } from '@/components/estilos';
import { AlertaError, Cargando, ContenedorTabla, EncabezadoPagina, Entrada, EtiquetaEstado, Tarjeta, Vacio } from '@/components/ui';
import { dinero, ESTADOS_PROYECTO } from '@/lib/formato';
import { useEmpresa } from '@/lib/modulos';
import type { EstadoProyecto, ProyectoResumen } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

type Filtro = EstadoProyecto | 'TODOS';
const FILTROS: Array<{ id: Filtro; texto: string; icono: LucideIcon }> = [
  { id: 'EN_CURSO', texto: 'En curso', icono: HardHat },
  { id: 'FINALIZADO', texto: 'Finalizadas', icono: CircleCheck },
  { id: 'CANCELADO', texto: 'Canceladas', icono: CircleSlash },
  { id: 'TODOS', texto: 'Todas', icono: Layers },
];

/** Proyectos (para Ale, "Obras"): cuánto se acordó, cuánto entregó el cliente y cuánto falta. */
export function ProyectosPage() {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const { etiqueta, etiquetaPlural, etiquetaMin } = useEmpresa();
  const [filtro, setFiltro] = useState<Filtro>('EN_CURSO');
  const [busqueda, setBusqueda] = useState('');
  const q = useDeferredValue(busqueda.trim());
  const parametros = new URLSearchParams({
    ...(filtro !== 'TODOS' ? { estado: filtro } : {}),
    ...(q ? { q } : {}),
  }).toString();
  const { data, error, isLoading } = useQuery({
    queryKey: ['proyectos', parametros],
    queryFn: () => pedir<ProyectoResumen[]>(`/proyectos${parametros ? `?${parametros}` : ''}`),
  });

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={etiquetaPlural}
        tituloEnBarra
        acciones={
          <Link to="/proyectos/nuevo" className={claseBoton('primario')}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Nueva {etiquetaMin}
          </Link>
        }
      />
      <Tarjeta>
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div
            role="tablist"
            aria-label="Estado"
            className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {FILTROS.map((f) => (
              <button
                key={f.id}
                role="tab"
                type="button"
                aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-fk px-3 text-sm whitespace-nowrap transition-colors ${
                  filtro === f.id
                    ? 'bg-fk-niebla font-semibold text-fk-fiordo'
                    : 'font-medium text-fk-gris-texto hover:bg-fk-niebla/60 hover:text-fk-grafito'
                }`}
              >
                <f.icono className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {f.texto}
              </button>
            ))}
          </div>
          <Entrada
            type="search"
            placeholder={`Buscar por ${etiquetaMin}, ubicación o cliente`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <AlertaError error={error} />
        {isLoading ? (
          <Cargando />
        ) : !data?.length ? (
          <Vacio
            accion={
              <Link to="/proyectos/nuevo" className={claseBoton('terciario')}>
                Cargar una {etiquetaMin}
              </Link>
            }
          >
            {q || filtro !== 'EN_CURSO' ? `No hay ${etiquetaPlural.toLowerCase()} con ese filtro.` : `Todavía no cargaste ninguna ${etiquetaMin}.`}
          </Vacio>
        ) : (
          <ContenedorTabla>
            <table className="fk-tabla">
              <thead>
                <tr>
                  <th>{etiqueta}</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th className="fk-num">Acordado</th>
                  <th className="fk-num">Entregado</th>
                  <th className="fk-num">Saldo</th>
                  <th className="fk-num">Vencido</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/proyectos/${p.id}`)}>
                    <td>
                      <Link to={`/proyectos/${p.id}`} className="font-semibold text-fk-fiordo hover:underline" onClick={(e) => e.stopPropagation()}>
                        {p.nombre}
                      </Link>
                      {p.ubicacion && <span className="block text-xs text-fk-gris-texto">{p.ubicacion}</span>}
                    </td>
                    <td>{p.cliente.razonSocial}</td>
                    <td>
                      <EtiquetaEstado estado={ESTADOS_PROYECTO[p.estado]} />
                    </td>
                    <td className="fk-num">{p.saldos.montoAcordado ? dinero(p.saldos.montoAcordado, p.moneda) : '—'}</td>
                    <td className="fk-num">{dinero(p.saldos.totalEntregado, p.moneda)}</td>
                    <td className="fk-num font-semibold">{dinero(p.saldos.saldo, p.moneda)}</td>
                    <td className={`fk-num ${Number(p.saldos.vencido) > 0 ? 'font-semibold text-fk-error-texto' : ''}`}>
                      {Number(p.saldos.vencido) > 0 ? dinero(p.saldos.vencido, p.moneda) : '—'}
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
