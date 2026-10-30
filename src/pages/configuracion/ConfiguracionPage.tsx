import { useState } from 'react';
import { Building2, FileSpreadsheet, FileText, Plug, Rocket, ShieldCheck, Store, Tags, Webhook } from 'lucide-react';
import { EncabezadoPagina } from '@/components/ui';
import { CertificadosSeccion } from './CertificadosSeccion';
import { EmisorSeccion } from './EmisorSeccion';
import { EstadoArcaTarjeta } from './EstadoArcaTarjeta';
import { IntegracionesSeccion } from './IntegracionesSeccion';
import { PlantillaSeccion } from './PlantillaSeccion';
import { PlantillasMapeoSeccion } from './PlantillasMapeoSeccion';
import { ProduccionSeccion } from './ProduccionSeccion';
import { PuntosVentaSeccion } from './PuntosVentaSeccion';
import { TarifasSeccion } from './TarifasSeccion';
import { WebhooksSeccion } from './WebhooksSeccion';

const PESTANAS = [
  { id: 'emisor', texto: 'Datos del emisor', icono: Building2 },
  { id: 'puntos', texto: 'Puntos de venta', icono: Store },
  { id: 'certificados', texto: 'Certificados ARCA', icono: ShieldCheck },
  { id: 'plantilla', texto: 'Plantilla PDF', icono: FileText },
  { id: 'produccion', texto: 'Producción', icono: Rocket },
  { id: 'tarifas', texto: 'Tarifas', icono: Tags },
  { id: 'mapeo', texto: 'Plantillas Excel', icono: FileSpreadsheet },
  { id: 'integraciones', texto: 'Integraciones', icono: Plug },
  { id: 'webhooks', texto: 'Webhooks', icono: Webhook },
] as const;

type Pestana = (typeof PESTANAS)[number]['id'];

function pestanaInicial(): Pestana {
  const p = new URLSearchParams(window.location.search).get('tab');
  return PESTANAS.some((x) => x.id === p) ? (p as Pestana) : 'emisor';
}

export function ConfiguracionPage() {
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);

  return (
    <div className="space-y-8">
      <EncabezadoPagina titulo="Configuración" />
      <EstadoArcaTarjeta />
      <div role="tablist" aria-label="Secciones" className="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-fk-borde px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm whitespace-nowrap transition-colors ${
              pestana === p.id
                ? 'border-fk-fiordo font-semibold text-fk-fiordo'
                : 'border-transparent font-medium text-fk-gris-texto hover:border-fk-borde hover:text-fk-grafito'
            }`}
          >
            <p.icono className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {p.texto}
          </button>
        ))}
      </div>
      <div>
        {pestana === 'emisor' && <EmisorSeccion />}
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
  );
}
