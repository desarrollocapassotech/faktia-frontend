import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus } from 'lucide-react';
import { AlertaError, Boton, BotonIcono, Cargando, ContenedorTabla, EncabezadoPagina, Entrada, Etiqueta, Tarjeta, TituloOrdenable, Vacio } from '@/components/ui';
import { CONDICIONES_IVA, documentoCliente } from '@/lib/formato';
import { useOrdenColumna, type OrdenDir } from '@/lib/orden';
import type { Cliente } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

type OrdenClientes = 'razonSocial' | 'documento';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Sin mayúsculas ni acentos; documento por número. Consumidor final (sin número) siempre al final. */
function ordenarClientes(lista: Cliente[], orden: { por: OrdenClientes; dir: OrdenDir } | null): Cliente[] {
  if (!orden) return lista;
  const signo = orden.dir === 'asc' ? 1 : -1;
  const documento = (c: Cliente) => (c.tipoDocumento === 'CONSUMIDOR_FINAL' ? null : c.numeroDocumento.replace(/\D/g, ''));
  return [...lista].sort((a, b) => {
    if (orden.por === 'razonSocial') return signo * collator.compare(a.razonSocial, b.razonSocial);
    const da = documento(a);
    const db = documento(b);
    if (da === null || db === null) return da === db ? collator.compare(a.razonSocial, b.razonSocial) : da === null ? 1 : -1;
    return signo * collator.compare(da, db) || collator.compare(a.razonSocial, b.razonSocial);
  });
}

export function ClientesPage() {
  const { pedir } = useApi();
  const [busqueda, setBusqueda] = useState('');
  const [inactivos, setInactivos] = useState(false);
  const q = useDeferredValue(busqueda.trim());
  const navigate = useNavigate();

  const { data, error, isFetching } = useQuery({
    queryKey: ['clientes', { q, inactivos }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (inactivos) params.set('incluirInactivos', 'true');
      return pedir<Cliente[]>(`/clientes?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  // El backend devuelve la lista entera (hasta 200, por razón social): el orden por columna se hace acá.
  const { orden, ordenColumna } = useOrdenColumna<OrdenClientes>(undefined, { documento: 'numero' });
  const ordenados = useMemo(() => ordenarClientes(data ?? [], orden), [data, orden]);

  return (
    <div className="space-y-8">
      <EncabezadoPagina titulo="Clientes" tituloEnBarra />
      <Tarjeta>
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <Entrada
            type="search"
            placeholder="Buscar por nombre o documento"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-sm"
          />
          <label className="flex items-center gap-2 text-sm text-fk-gris-texto">
            <input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
          {isFetching && <span className="text-xs text-fk-gris-texto">Buscando…</span>}
          <Boton className="ml-auto" onClick={() => navigate('/clientes/nuevo')}>
            <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            Nuevo cliente
          </Boton>
        </div>
        {error ? (
          <AlertaError error={error} />
        ) : !data ? (
          <Cargando />
        ) : data.length === 0 ? (
          q ? (
            <Vacio>No hay clientes que coincidan con la búsqueda.</Vacio>
          ) : (
            <Vacio accion={<Boton onClick={() => navigate('/clientes/nuevo')}>Nuevo cliente</Boton>}>Todavía no cargaste clientes.</Vacio>
          )
        ) : (
          <ContenedorTabla>
            <table className="fk-tabla">
              <thead>
                <tr>
                  <th>
                    <TituloOrdenable titulo="Razón social" orden={ordenColumna('razonSocial')} />
                  </th>
                  <th>
                    <TituloOrdenable titulo="Documento" orden={ordenColumna('documento')} />
                  </th>
                  <th>Condición IVA</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/clientes/${c.id}`)}
                    title="Click para ver el detalle"
                    className="cursor-pointer transition-colors hover:bg-fk-niebla/50"
                  >
                    <td>
                      <Link
                        to={`/clientes/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-fk-fiordo underline-offset-2 hover:underline"
                      >
                        {c.razonSocial}
                      </Link>
                      {!c.activo && <Etiqueta className="ml-2">Inactivo</Etiqueta>}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{documentoCliente(c)}</td>
                    <td>{CONDICIONES_IVA[c.condicionIva]}</td>
                    {/* Los íconos hacen su acción; no abren el detalle de la fila. */}
                    <td className="py-1" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <BotonIcono etiqueta="Ver detalle" icono={Eye} onClick={() => navigate(`/clientes/${c.id}`)} />
                        <BotonIcono etiqueta="Editar cliente" icono={Pencil} onClick={() => navigate(`/clientes/${c.id}/editar`)} />
                      </div>
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
