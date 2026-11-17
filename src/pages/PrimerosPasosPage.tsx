import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { AlertaError, Ayuda, Cargando, EncabezadoPagina } from '@/components/ui';
import type { Emisor } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { AsistenteCertificado } from './configuracion/AsistenteCertificado';
import { EmisorSeccion } from './configuracion/EmisorSeccion';

/**
 * Lo primero que se ve al entrar mientras la empresa no terminó de configurarse: los datos
 * fiscales y después el certificado de producción. Se puede dejar para más tarde (se sigue en
 * modo de pruebas) y retomar: el avance queda guardado.
 */
export function PrimerosPasosPage() {
  const { pedir } = useApi();
  const { tenant } = useAuth();
  const emisor = useQuery({ queryKey: ['emisor'], queryFn: () => pedir<Emisor>('/configuracion/emisor') });

  if (emisor.error) return <AlertaError error={emisor.error} />;
  if (!emisor.data) return <Cargando />;

  // El perfil de la sesión se refresca al guardar los datos; el emisor, al invalidar la consulta.
  const datosListos = emisor.data.datosFiscalesCompletos && tenant?.datosFiscalesCompletos !== false;
  const enProduccion = emisor.data.ambienteArca === 'PRODUCCION';

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <EncabezadoPagina
        titulo={
          <span className="inline-flex items-center gap-2">
            {enProduccion ? '¡Tu empresa está lista!' : 'Configurá tu empresa'}
            {!enProduccion && (
              <Ayuda etiqueta="Por qué configurar">
                Para emitir facturas con validez fiscal. Mientras tanto podés usar Faktia en modo de pruebas: los comprobantes salen con la
                marca “sin validez fiscal”. Tu avance queda guardado.
              </Ayuda>
            )}
          </span>
        }
        acciones={
          <Link to="/comprobantes" className="inline-flex min-h-10 items-center text-sm font-semibold text-fk-fiordo underline-offset-2 hover:underline">
            {enProduccion ? 'Ir a Comprobantes' : 'Lo hago más tarde'}
          </Link>
        }
      />

      <ol className="flex flex-wrap gap-x-8 gap-y-2 text-sm" aria-label="Etapas">
        <Etapa n={1} texto="Datos de tu empresa" lista={datosListos} actual={!datosListos} />
        <Etapa n={2} texto="Certificado de ARCA" lista={enProduccion} actual={datosListos && !enProduccion} />
      </ol>

      {datosListos ? <AsistenteCertificado emisor={emisor.data} /> : <EmisorSeccion />}
    </div>
  );
}

function Etapa({ n, texto, lista, actual }: { n: number; texto: string; lista: boolean; actual: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${actual ? 'font-semibold text-fk-grafito' : lista ? 'text-fk-ok-texto' : 'text-fk-gris-texto'}`}>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${
          lista ? 'bg-fk-pino text-fk-blanco' : actual ? 'bg-fk-fiordo text-fk-blanco' : 'bg-fk-niebla text-fk-fiordo'
        }`}
      >
        {lista ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : n}
      </span>
      {texto}
    </li>
  );
}
