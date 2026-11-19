import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MarcoPublico } from '@/components/MarcoPublico';
import { Cargando } from '@/components/ui';
import { api } from '@/lib/api';
import { dinero, fecha } from '@/lib/formato';
import type { Moneda } from '@/lib/tipos';

interface ReciboVerificado {
  valido: true;
  emisor: string;
  tipo: 'COBRO' | 'PAGO';
  numero: string | null;
  fecha: string;
  moneda: Moneda;
  total: string;
  contraparte: string;
}

/**
 * Página pública a la que lleva el QR de un recibo: confirma que existe en Faktia y muestra lo mismo
 * que dice el papel, para compararlo. Sin sesión: la firma del link (`c`) es la credencial.
 */
export function VerificarReciboPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const firma = params.get('c') ?? '';

  const { data, isError, isPending } = useQuery({
    queryKey: ['verificar-recibo', id, firma],
    queryFn: () => api<ReciboVerificado>(`/recibos/verificar/${encodeURIComponent(id)}?c=${encodeURIComponent(firma)}`),
    enabled: Boolean(id && firma),
    retry: false,
  });

  return (
    <MarcoPublico>
      {!firma || isError ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-fk-error-fondo text-fk-error-texto">
            <ShieldX className="h-8 w-8" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-fk-error-texto">No pudimos verificar este recibo</h1>
          <p className="text-sm text-fk-gris-texto">El código no corresponde a un recibo emitido con Faktia. Pedile a quien lo emitió una copia nueva.</p>
        </div>
      ) : isPending ? (
        <Cargando texto="Verificando…" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-fk-ok-fondo text-fk-ok-texto">
              <ShieldCheck className="h-8 w-8" strokeWidth={1.75} aria-hidden />
            </span>
            <h1 className="text-xl font-semibold text-fk-ok-texto">Recibo válido</h1>
            <p className="text-sm text-fk-gris-texto">Fue emitido con Faktia. Compará estos datos con los del recibo.</p>
          </div>
          <dl className="divide-y divide-fk-borde rounded-fk border border-fk-borde text-sm">
            <Fila titulo="Emitido por" valor={data.emisor} />
            <Fila titulo="Tipo" valor={data.tipo === 'COBRO' ? 'Recibo de cobro' : 'Recibo de pago'} />
            {data.numero && <Fila titulo="Número" valor={data.numero} />}
            <Fila titulo="Fecha" valor={fecha(data.fecha)} />
            <Fila titulo={data.tipo === 'COBRO' ? 'Pagó' : 'Cobró'} valor={data.contraparte} />
            <Fila titulo="Total" valor={dinero(data.total, data.moneda)} fuerte />
          </dl>
        </div>
      )}
    </MarcoPublico>
  );
}

function Fila({ titulo, valor, fuerte }: { titulo: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-fk-gris-texto">{titulo}</dt>
      <dd className={`text-right tabular-nums ${fuerte ? 'text-base font-semibold text-fk-fiordo' : 'font-medium text-fk-grafito'}`}>{valor}</dd>
    </div>
  );
}
