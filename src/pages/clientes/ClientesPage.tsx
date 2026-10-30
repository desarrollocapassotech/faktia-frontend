import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { AlertaError, Boton, Cargando, Entrada, Etiqueta, Tarjeta, Vacio } from '@/components/ui';
import { CONDICIONES_IVA, cuit, TIPOS_DOCUMENTO } from '@/lib/formato';
import type { Cliente } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { ClienteModal } from './ClienteModal';

export function ClientesPage() {
  const { pedir } = useApi();
  const [busqueda, setBusqueda] = useState('');
  const [inactivos, setInactivos] = useState(false);
  const q = useDeferredValue(busqueda.trim());
  // undefined = cerrado; null = nuevo; Cliente = edición.
  const [editando, setEditando] = useState<Cliente | null | undefined>(undefined);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">Clientes</h1>
        <Boton onClick={() => setEditando(null)}>Nuevo cliente</Boton>
      </div>
      <Tarjeta>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Entrada
            type="search"
            placeholder="Buscar por nombre o documento"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-sm"
          />
          <label className="flex items-center gap-2 text-sm text-acero">
            <input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
          {isFetching && <span className="text-xs text-acero/60">Buscando…</span>}
        </div>
        {error ? (
          <AlertaError error={error} />
        ) : !data ? (
          <Cargando />
        ) : data.length === 0 ? (
          <Vacio>{q ? 'No hay clientes que coincidan con la búsqueda.' : 'Todavía no cargaste clientes.'}</Vacio>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-6">
            <table className="w-full text-sm">
              <thead className="bg-niebla text-left font-[family-name:var(--font-ui)] text-[13px] uppercase tracking-[0.08em] text-marca [&_th]:border-b [&_th]:border-black/10">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Razón social</th>
                  <th className="px-3 py-2.5 font-medium">Documento</th>
                  <th className="px-3 py-2.5 font-medium">Condición IVA</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">
                      {c.razonSocial}
                      {!c.activo && <Etiqueta className="ml-2 border-zinc-300/90 bg-zinc-100 text-zinc-800">Inactivo</Etiqueta>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.tipoDocumento === 'CONSUMIDOR_FINAL'
                        ? TIPOS_DOCUMENTO.CONSUMIDOR_FINAL
                        : `${c.tipoDocumento} ${c.tipoDocumento === 'CUIT' || c.tipoDocumento === 'CUIL' ? cuit(c.numeroDocumento) : c.numeroDocumento}`}
                    </td>
                    <td className="px-3 py-2">{CONDICIONES_IVA[c.condicionIva]}</td>
                    <td className="px-3 py-2 text-right">
                      <Boton variante="fantasma" onClick={() => setEditando(c)}>
                        Editar
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      {editando !== undefined && (
        <ClienteModal key={editando?.id ?? 'nuevo'} abierto cliente={editando} onCerrar={() => setEditando(undefined)} />
      )}
    </div>
  );
}
