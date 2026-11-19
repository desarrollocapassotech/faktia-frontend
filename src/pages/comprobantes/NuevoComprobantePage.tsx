import { useQueryClient } from '@tanstack/react-query';
import { FilePlus, FileSpreadsheet, HandCoins, Receipt, ScrollText, Wallet, type LucideIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EncabezadoPagina } from '@/components/ui';
import { CreacionMasiva } from '@/pages/importaciones/ImportacionesPage';
import { FormularioRecibo } from '@/pages/recibos/RecibosPage';
import { EditorComprobante } from './EditorComprobante';

type Clase = 'factura' | 'recibo';
type Modo = 'una' | 'masiva' | 'cobro' | 'pago';

type Opcion<T extends string> = { id: T; titulo: string; ayuda: string; icono: LucideIcon };

const CLASES: Opcion<Clase>[] = [
  { id: 'factura', titulo: 'Factura', ayuda: 'Con CAE de ARCA', icono: Receipt },
  { id: 'recibo', titulo: 'Recibo', ayuda: 'PDF con tu logo', icono: ScrollText },
];

const MODOS: Record<Clase, Opcion<Modo>[]> = {
  factura: [
    { id: 'una', titulo: 'Una sola', ayuda: 'La cargás a mano', icono: FilePlus },
    { id: 'masiva', titulo: 'Masiva', ayuda: 'Desde una planilla', icono: FileSpreadsheet },
  ],
  recibo: [
    { id: 'cobro', titulo: 'De cobro', ayuda: 'Un cliente te paga', icono: HandCoins },
    { id: 'pago', titulo: 'De pago', ayuda: 'Vos le pagás a alguien', icono: Wallet },
  ],
};

/**
 * Nuevo comprobante: se elige qué crear con tarjetas grandes (Factura / Recibo y después el tipo) y
 * aparece el formulario. La elección vive en la URL (`?tipo=factura&modo=una`), así se puede enlazar
 * directo a cualquier paso y "atrás" del navegador funciona.
 */
export function NuevoComprobantePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const modoUrl = params.get('modo');
  // `?modo=masiva` sin tipo (link viejo de Creación masiva) es una factura.
  const clase = (params.get('tipo') ?? (modoUrl === 'una' || modoUrl === 'masiva' ? 'factura' : null)) as Clase | null;
  const claseValida = clase && clase in MODOS ? clase : null;
  const modo = claseValida && MODOS[claseValida].some((m) => m.id === modoUrl) ? (modoUrl as Modo) : null;

  function elegir(nuevaClase: Clase | null, nuevoModo: Modo | null) {
    const p: Record<string, string> = {};
    if (nuevaClase) p.tipo = nuevaClase;
    if (nuevoModo) p.modo = nuevoModo;
    setParams(p);
  }

  const elegidaClase = CLASES.find((c) => c.id === claseValida);
  const elegidoModo = claseValida ? MODOS[claseValida].find((m) => m.id === modo) : undefined;
  const migas = [
    { texto: 'Comprobantes', a: '/comprobantes' },
    ...(elegidaClase ? [{ texto: 'Nuevo comprobante', a: '/comprobantes/nuevo' }] : []),
    { texto: elegidaClase ? `${elegidaClase.titulo}${elegidoModo ? ` · ${elegidoModo.titulo.toLowerCase()}` : ''}` : 'Nuevo comprobante' },
  ];

  return (
    <div className="space-y-8">
      <EncabezadoPagina titulo="Nuevo comprobante" tituloEnBarra migas={migas} />

      {!claseValida ? (
        <Tarjetas
          opciones={CLASES}
          onElegir={(c) => elegir(c, null)}
          atajos={(c) => ({ opciones: MODOS[c], onElegir: (m) => elegir(c, m) })}
        />
      ) : !modo ? (
        <div className="space-y-4">
          <Selector opciones={CLASES} elegida={claseValida} onElegir={(c) => elegir(c, null)} etiqueta="Tipo de comprobante" />
          <Tarjetas opciones={MODOS[claseValida]} onElegir={(m) => elegir(claseValida, m)} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Selector opciones={CLASES} elegida={claseValida} onElegir={(c) => elegir(c, null)} etiqueta="Tipo de comprobante" />
            <Selector opciones={MODOS[claseValida]} elegida={modo} onElegir={(m) => elegir(claseValida, m)} etiqueta="Forma" />
          </div>
          {modo === 'una' && (
            <EditorComprobante
              onGuardado={(c) => {
                queryClient.setQueryData(['comprobante', c.id], c);
                void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
                navigate(`/comprobantes/${c.id}`, { replace: true });
              }}
            />
          )}
          {modo === 'masiva' && <CreacionMasiva />}
          {(modo === 'cobro' || modo === 'pago') && (
            <FormularioRecibo
              key={modo}
              tipo={modo === 'cobro' ? 'COBRO' : 'PAGO'}
              // Desde Cuenta corriente → Registrar cobro: el cliente ya elegido y, al guardar, vuelve a su cuenta.
              clienteInicial={modo === 'cobro' ? (params.get('cliente') ?? undefined) : undefined}
              volverACuenta={params.get('volver') === 'cuenta'}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Paso a elegir: tarjetas grandes que llenan el espacio. Con `atajos`, cada tarjeta muestra abajo sus
 * opciones del paso siguiente como pastillas: tocar una salta directo al formulario.
 */
function Tarjetas<T extends string>({
  opciones,
  onElegir,
  atajos,
}: {
  opciones: Opcion<T>[];
  onElegir: (id: T) => void;
  atajos?: (id: T) => { opciones: Opcion<Modo>[]; onElegir: (m: Modo) => void };
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 sm:min-h-[calc(100vh-14rem)]">
      {opciones.map((o) => {
        const a = atajos?.(o.id);
        return (
          <div
            key={o.id}
            className="group relative flex min-h-72 flex-col items-center justify-center gap-6 rounded-fk border border-fk-borde bg-fk-blanco px-6 py-12 text-center transition-all hover:-translate-y-1 hover:border-fk-fiordo hover:shadow-lg has-[:focus-visible]:border-fk-fiordo"
          >
            {/* Toda la tarjeta es el botón (las pastillas de abajo van por encima). */}
            <button type="button" onClick={() => onElegir(o.id)} className="absolute inset-0 rounded-fk focus:outline-none" aria-label={`${o.titulo}: ${o.ayuda}`} />
            <span className="pointer-events-none flex h-24 w-24 items-center justify-center rounded-full bg-fk-niebla text-fk-fiordo transition-all duration-300 group-hover:scale-105 group-hover:bg-fk-fiordo group-hover:text-fk-blanco lg:h-32 lg:w-32">
              <o.icono className="h-12 w-12 lg:h-16 lg:w-16" strokeWidth={1.25} aria-hidden />
            </span>
            <span className="pointer-events-none">
              <span className="block text-2xl font-semibold text-fk-fiordo lg:text-3xl">{o.titulo}</span>
              <span className="mt-2 block text-base text-fk-gris-texto">{o.ayuda}</span>
            </span>
            {a && (
              <span className="relative z-10 flex flex-wrap justify-center gap-2">
                {a.opciones.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => a.onElegir(m.id)}
                    title={m.ayuda}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-fk-borde bg-fk-blanco px-3.5 text-sm font-medium text-fk-gris-texto transition-colors hover:border-fk-fiordo hover:bg-fk-fiordo hover:text-fk-blanco"
                  >
                    <m.icono className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    {m.titulo}
                  </button>
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Lo ya elegido, compacto: un control segmentado para cambiarlo sin volver atrás. */
function Selector<T extends string>({
  opciones,
  elegida,
  onElegir,
  etiqueta,
}: {
  opciones: Opcion<T>[];
  elegida: T;
  onElegir: (id: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex rounded-fk border border-fk-borde bg-fk-blanco p-1">
      {opciones.map((o) => {
        const activa = o.id === elegida;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={activa}
            title={o.ayuda}
            onClick={() => !activa && onElegir(o.id)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-[calc(var(--radius-fk)-2px)] px-3 text-sm font-medium transition-colors ${
              activa ? 'bg-fk-fiordo text-fk-blanco' : 'text-fk-gris-texto hover:bg-fk-niebla hover:text-fk-fiordo'
            }`}
          >
            <o.icono className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {o.titulo}
          </button>
        );
      })}
    </div>
  );
}
