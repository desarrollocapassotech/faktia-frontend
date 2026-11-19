import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertaError, Boton, Cargando, ContenedorTabla, EncabezadoPagina, EtiquetaEstado, Tarjeta } from '@/components/ui';
import { dinero, ESTADOS, fecha, fechaHora } from '@/lib/formato';
import type { Recibo } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

const TITULOS = { COBRO: 'Recibo de cobro', PAGO: 'Recibo de pago' } as const;

/** Detalle de un recibo guardado: lo mismo que el PDF, en pantalla. No se edita (como un comprobante emitido). */
export function ReciboDetallePage() {
  const { id = '' } = useParams();
  const { pedir, verEnPestana } = useApi();
  const [errorPdf, setErrorPdf] = useState<unknown>(null);

  const { data: r, error } = useQuery({
    queryKey: ['recibo', id],
    queryFn: () => pedir<Recibo>(`/recibos/${id}`),
  });

  async function verPdf() {
    setErrorPdf(null);
    try {
      await verEnPestana(`/recibos/${id}/pdf`);
    } catch (err) {
      setErrorPdf(err);
    }
  }

  if (error) return <AlertaError error={error} />;
  if (!r) return <Cargando />;

  const titulo = TITULOS[r.tipo];
  const esCobro = r.tipo === 'COBRO';

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={titulo}
        tituloEnBarra
        migas={[{ texto: 'Comprobantes', a: '/comprobantes' }, { texto: r.numero ? `${titulo} ${r.numero}` : titulo }]}
        junto={<EtiquetaEstado estado={ESTADOS.EMITIDO} />}
      />
      <AlertaError error={errorPdf} />

      <Tarjeta
        titulo="Datos"
        acciones={
          <Boton onClick={() => void verPdf()}>
            <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
            Ver PDF
          </Boton>
        }
      >
        <dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato titulo="Número" valor={<span className="tabular-nums">{r.numero ?? '—'}</span>} />
          <Dato titulo="Fecha" valor={<span className="tabular-nums">{fecha(r.fecha)}</span>} />
          <Dato titulo="Moneda" valor={r.moneda === 'USD' ? 'Dólares' : 'Pesos'} />
          <Dato titulo="Creado" valor={<span className="tabular-nums">{fechaHora(r.createdAt)}</span>} />
          <Dato
            titulo={esCobro ? 'Quién pagó' : 'A quién se le pagó'}
            valor={
              r.clienteId ? (
                <Link to="/clientes" className="text-fk-fiordo underline-offset-2 hover:underline">
                  {r.contraparte.nombre}
                </Link>
              ) : (
                r.contraparte.nombre
              )
            }
          />
          {r.contraparte.documento && <Dato titulo="Documento" valor={<span className="tabular-nums">{r.contraparte.documento}</span>} />}
          {r.contraparte.domicilio && <Dato titulo="Domicilio" valor={r.contraparte.domicilio} />}
          {r.periodo && <Dato titulo="Período" valor={r.periodo} />}
          {r.medioPago && <Dato titulo="Medio de pago" valor={r.medioPago} />}
          {r.observaciones && <Dato titulo="Observaciones" valor={r.observaciones} />}
        </dl>
      </Tarjeta>

      <Tarjeta titulo="Conceptos">
        <ContenedorTabla>
          <table className="fk-tabla">
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="fk-num">Cantidad</th>
                <th className="fk-num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {r.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.descripcion}</td>
                  <td className="fk-num">{it.cantidad || '—'}</td>
                  <td className="fk-num">{dinero(it.importe, r.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContenedorTabla>
        <div className="mt-6 ml-auto flex max-w-xs justify-between gap-4 border-t border-fk-borde pt-4 text-base font-semibold text-fk-fiordo">
          <span>Total</span>
          <span className="fk-num">{dinero(r.total, r.moneda)}</span>
        </div>
      </Tarjeta>

      {r.comprobantesAplicados && r.comprobantesAplicados.length > 0 && (
        <Tarjeta titulo="Comprobantes que cancela">
          <ul className="divide-y divide-fk-borde text-sm">
            {r.comprobantesAplicados.map((c, i) => (
              <li key={i} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <span>{c.descripcion}</span>
                <span className="fk-num">{dinero(c.importe, r.moneda)}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="fk-etiqueta">{titulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
