import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertaError, Boton, Cargando, ContenedorTabla, EncabezadoPagina, EtiquetaEstado, Selector, Tarjeta, Vacio } from '@/components/ui';
import { dinero, ESTADOS, fecha, numeroComprobante, tipoLargo } from '@/lib/formato';
import type { ComprobanteResumen, EstadoComprobante, Paginado } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

const POR_PAGINA = 25;

export function ComprobantesPage() {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoComprobante | ''>('');
  const [pagina, setPagina] = useState(1);

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
      <EncabezadoPagina titulo="Comprobantes" acciones={<Boton onClick={() => navigate('/comprobantes/nuevo')}>Nueva factura</Boton>} />
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
        </div>
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
                        <EtiquetaEstado estado={ESTADOS[c.estado]} />
                        {c.ambiente === 'HOMOLOGACION' && <span className="ml-2 text-xs text-fk-pendiente-texto">Prueba</span>}
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
    </div>
  );
}
