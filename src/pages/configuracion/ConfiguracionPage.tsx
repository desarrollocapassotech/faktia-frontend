import { useSearchParams } from 'react-router-dom';
import { Building2, FileSpreadsheet, FileText, Plug, Rocket, ShieldCheck, SlidersHorizontal, Store, Tags, Webhook } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { EncabezadoPagina } from '@/components/ui';
import { useEmpresa, type Modulo } from '@/lib/modulos';
import { CertificadosSeccion } from './CertificadosSeccion';
import { EmisorSeccion } from './EmisorSeccion';
import { IntegracionesSeccion } from './IntegracionesSeccion';
import { PlantillaSeccion } from './PlantillaSeccion';
import { PlantillasMapeoSeccion } from './PlantillasMapeoSeccion';
import { PreferenciasSeccion } from './PreferenciasSeccion';
import { ProduccionSeccion } from './ProduccionSeccion';
import { PuntosVentaSeccion } from './PuntosVentaSeccion';
import { TarifasSeccion } from './TarifasSeccion';
import { WebhooksSeccion } from './WebhooksSeccion';

// requiereDatosFiscales: no se muestran hasta que la empresa cargue CUIT, razón social y demás datos del emisor.
// modulo: la pestaña se ve solo si la empresa tiene ese módulo habilitado.
const PESTANAS = [
  { id: 'emisor', texto: 'Datos del emisor', icono: Building2 },
  { id: 'preferencias', texto: 'Preferencias', icono: SlidersHorizontal },
  { id: 'puntos', texto: 'Puntos de venta', icono: Store, modulo: 'comprobantes' },
  { id: 'certificados', texto: 'Certificados ARCA', icono: ShieldCheck, requiereDatosFiscales: true, modulo: 'comprobantes' },
  { id: 'plantilla', texto: 'Plantilla PDF', icono: FileText },
  { id: 'produccion', texto: 'Producción', icono: Rocket, requiereDatosFiscales: true, modulo: 'comprobantes' },
  { id: 'tarifas', texto: 'Tarifas', icono: Tags, modulo: 'importaciones' },
  { id: 'mapeo', texto: 'Plantillas Excel', icono: FileSpreadsheet, modulo: 'importaciones' },
  { id: 'integraciones', texto: 'Integraciones', icono: Plug, modulo: 'integraciones' },
  { id: 'webhooks', texto: 'Webhooks', icono: Webhook, modulo: 'webhooks' },
] as const satisfies ReadonlyArray<{ id: string; texto: string; icono: unknown; requiereDatosFiscales?: boolean; modulo?: Modulo }>;

type Pestana = (typeof PESTANAS)[number]['id'];

export function ConfiguracionPage() {
  const { tenant } = useAuth();
  // La pestaña vive en la URL (?tab=): así un link a /configuracion?tab=produccion cambia de pestaña.
  const [params, setParams] = useSearchParams();
  const p = params.get('tab');
  const elegida: Pestana = PESTANAS.some((x) => x.id === p) ? (p as Pestana) : 'emisor';
  const setPestana = (id: Pestana) => setParams(id === 'emisor' ? {} : { tab: id }, { replace: true });
  const datosCompletos = tenant?.datosFiscalesCompletos !== false;
  const { tiene } = useEmpresa();
  const visibles = PESTANAS.filter((p) => (datosCompletos || !('requiereDatosFiscales' in p)) && (!('modulo' in p) || tiene(p.modulo)));
  // Si llega por ?tab=certificados sin datos fiscales, cae en Datos del emisor.
  const pestana: Pestana = visibles.some((p) => p.id === elegida) ? elegida : 'emisor';

  return (
    <div className="space-y-8">
      <EncabezadoPagina titulo="Configuración" tituloEnBarra />
      {/* Desktop: pestañas en columna a la izquierda. Mobile: fila con scroll horizontal arriba del contenido. */}
      <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div
          role="tablist"
          aria-label="Secciones"
          className="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-fk-borde px-4 [scrollbar-width:none] md:mx-0 md:px-0 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:border-b-0 [&::-webkit-scrollbar]:hidden"
        >
          {visibles.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm whitespace-nowrap transition-colors lg:mb-0 lg:rounded-fk lg:border-b-0 lg:text-left ${
                pestana === p.id
                  ? 'border-fk-fiordo font-semibold text-fk-fiordo lg:bg-fk-niebla'
                  : 'border-transparent font-medium text-fk-gris-texto hover:border-fk-borde hover:text-fk-grafito lg:hover:bg-fk-niebla/60'
              }`}
            >
              <p.icono className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {p.texto}
            </button>
          ))}
        </div>
        <div className="min-w-0">
          {pestana === 'emisor' && <EmisorSeccion />}
          {pestana === 'preferencias' && <PreferenciasSeccion />}
          {pestana === 'puntos' && <PuntosVentaSeccion />}
          {pestana === 'certificados' && <CertificadosSeccion />}
          {pestana === 'plantilla' && <PlantillaSeccion />}
          {pestana === 'produccion' && <ProduccionSeccion />}
          {pestana === 'tarifas' && <TarifasSeccion />}
          {pestana === 'mapeo' && <PlantillasMapeoSeccion />}
          {pestana === 'integraciones' && <IntegracionesSeccion />}
          {pestana === 'webhooks' && <WebhooksSeccion />}
        </div>
      </div>
    </div>
  );
}
