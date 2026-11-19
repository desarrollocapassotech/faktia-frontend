import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { AlertaError, Boton, Cargando, ContenedorTabla, EncabezadoPagina, Entrada, Etiqueta, Tarjeta, Vacio } from '@/components/ui';
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
          <Boton className="ml-auto" onClick={() => setEditando(null)}>
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
            <Vacio accion={<Boton onClick={() => setEditando(null)}>Nuevo cliente</Boton>}>Todavía no cargaste clientes.</Vacio>
          )
        ) : (
          <ContenedorTabla>
            <table className="fk-tabla">
              <thead>
                <tr>
                  <th>Razón social</th>
                  <th>Documento</th>
                  <th>Condición IVA</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.razonSocial}
                      {!c.activo && <Etiqueta className="ml-2">Inactivo</Etiqueta>}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {c.tipoDocumento === 'CONSUMIDOR_FINAL'
                        ? TIPOS_DOCUMENTO.CONSUMIDOR_FINAL
                        : `${c.tipoDocumento} ${c.tipoDocumento === 'CUIT' || c.tipoDocumento === 'CUIL' ? cuit(c.numeroDocumento) : c.numeroDocumento}`}
                    </td>
                    <td>{CONDICIONES_IVA[c.condicionIva]}</td>
                    <td className="text-right">
                      <Boton variante="fantasma" onClick={() => setEditando(c)}>
                        Editar
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ContenedorTabla>
        )}
      </Tarjeta>
      {editando !== undefined && (
        <ClienteModal key={editando?.id ?? 'nuevo'} abierto cliente={editando} onCerrar={() => setEditando(undefined)} />
      )}
    </div>
  );
}
