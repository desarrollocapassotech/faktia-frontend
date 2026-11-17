import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { AlertaError, Ayuda, Cargando, Etiqueta } from '@/components/ui';
import { fecha } from '@/lib/formato';
import type { Certificado, Emisor } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { AsistenteCertificado, SubirCertificado } from './AsistenteCertificado';

const DIAS_AVISO = 30;

function diasHasta(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function CertificadosSeccion() {
  const { pedir } = useApi();
  const certificados = useQuery({ queryKey: ['certificados'], queryFn: () => pedir<Certificado[]>('/configuracion/certificados') });
  const emisor = useQuery({ queryKey: ['emisor'], queryFn: () => pedir<Emisor>('/configuracion/emisor') });

  if (certificados.error) return <AlertaError error={certificados.error} />;
  if (!certificados.data || !emisor.data) return <Cargando />;
  const tieneProduccion = certificados.data.some((c) => c.ambiente === 'PRODUCCION');

  return (
    <div className="space-y-6">
      {/* Con certificados cargados, primero se ve lo que hay; sin ninguno, directamente el asistente. */}
      {certificados.data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {certificados.data.map((c) => (
            <TarjetaCertificado key={c.id} certificado={c} />
          ))}
        </div>
      )}
      {!tieneProduccion ? (
        <AsistenteCertificado emisor={emisor.data} />
      ) : (
        <details className="rounded-fk border border-fk-borde bg-fk-blanco px-4 py-4 text-sm sm:px-6">
          <summary className="cursor-pointer font-semibold text-fk-fiordo">Renovar el certificado de producción (paso a paso)</summary>
          <div className="mt-4">
            <AsistenteCertificado emisor={emisor.data} />
          </div>
        </details>
      )}
      {/* Para quien ya tiene el .crt y el .key (ej. los tramitó por su cuenta). Solo producción: en
          homologación no hace falta certificado, se emite con el CUIT de prueba de AfipSDK. */}
      <details className="rounded-fk border border-fk-borde bg-fk-blanco px-4 py-4 text-sm sm:px-6">
        <summary className="cursor-pointer font-semibold text-fk-fiordo">Ya tengo el certificado: subirlo directo</summary>
        <div className="mt-4">
          <SubirCertificado yaCargado={tieneProduccion} />
        </div>
      </details>
    </div>
  );
}

/** "en 2 años", "en 3 meses", "en 12 días", "hace 5 días". */
function cuanto(dias: number): string {
  const n = Math.abs(dias);
  const texto =
    n >= 365 ? `${Math.floor(n / 365)} ${Math.floor(n / 365) === 1 ? 'año' : 'años'}`
    : n >= 60 ? `${Math.floor(n / 30)} meses`
    : `${n} ${n === 1 ? 'día' : 'días'}`;
  return dias < 0 ? `hace ${texto}` : `en ${texto}`;
}

function TarjetaCertificado({ certificado: c }: { certificado: Certificado }) {
  const dias = diasHasta(c.venceEl);
  const estado =
    dias < 0
      ? { texto: 'Vencido', tono: 'error' as const, icono: ShieldAlert, color: 'bg-fk-error-fondo text-fk-error-texto' }
      : dias <= DIAS_AVISO
        ? { texto: 'Vence pronto', tono: 'pendiente' as const, icono: ShieldAlert, color: 'bg-fk-pendiente-fondo text-fk-pendiente-texto' }
        : { texto: 'Vigente', tono: 'ok' as const, icono: ShieldCheck, color: 'bg-fk-ok-fondo text-fk-ok-texto' };
  return (
    <section className="flex items-start gap-4 rounded-fk border border-fk-borde bg-fk-blanco p-5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${estado.color}`}>
        <estado.icono className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-fk-grafito">Certificado de {c.ambiente === 'PRODUCCION' ? 'producción' : 'pruebas'}</h3>
          <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
        </div>
        <p className="text-sm text-fk-gris-texto tabular-nums">
          {dias < 0 ? 'Venció' : 'Vence'} el {fecha(c.venceEl)} · {cuanto(dias)}
        </p>
        <p className="flex items-center gap-1 text-xs text-fk-gris-texto">
          Cargado el {fecha(c.createdAt)}
          <Ayuda etiqueta="Datos técnicos">
            <span className="block font-semibold">Huella SHA-256</span>
            <span className="block font-mono text-[11px] break-all">{c.huellaSha256}</span>
            <span className="mt-2 block">Sirve para comparar con el certificado que ves en ARCA. Antes del vencimiento, renovalo con el paso a paso.</span>
          </Ayuda>
        </p>
      </div>
    </section>
  );
}
