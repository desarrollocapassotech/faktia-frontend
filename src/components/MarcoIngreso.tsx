import type { ReactNode } from 'react';
import { CalendarClock, FileText, ShieldCheck, Wallet } from 'lucide-react';

const BENEFICIOS = [
  { icono: ShieldCheck, texto: 'Facturas autorizadas por ARCA' },
  { icono: FileText, texto: 'Presupuestos y recibos con tu marca' },
  { icono: Wallet, texto: 'Cuenta corriente de cada cliente' },
  { icono: CalendarClock, texto: 'Cobranzas y vencimientos al día' },
];

/**
 * Factura de ejemplo que se "imprime" al entrar (mismo lenguaje que los toasts y el loader: papel con
 * zigzag, número, total y sello). Ilustración: los datos no son reales. Estilos en index.css (`.fk-ingreso-*`).
 */
function FacturaEjemplo() {
  return (
    <div className="fk-ingreso-ilustracion" aria-hidden>
      <div className="fk-ingreso-ranura" />
      <div className="fk-ingreso-boca">
        {/* Un ticket atrás, quieto, para dar profundidad. */}
        <div className="fk-ingreso-atras fk-papel-zigzag" />
        <div className="fk-ingreso-mover fk-papel-sombra">
          <div className="fk-papel-zigzag relative bg-fk-blanco px-6 pt-5 pb-8 text-fk-grafito">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="fk-etiqueta">Factura C</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">N° 00002-00000148</p>
              </div>
              <img src="/brand/faktia-icono.svg" alt="" className="h-7 w-7" />
            </div>
            <div className="my-3 border-t border-dashed border-fk-borde" />
            <ul className="space-y-1.5 text-[13px]">
              <li className="flex justify-between gap-4">
                <span>Instalación eléctrica</span>
                <span className="tabular-nums">$ 180.000,00</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Materiales</span>
                <span className="tabular-nums">$ 52.500,00</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Mano de obra</span>
                <span className="tabular-nums">$ 15.000,00</span>
              </li>
            </ul>
            <div className="my-3 border-t border-dashed border-fk-borde" />
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-xl font-semibold text-fk-fiordo tabular-nums">$ 247.500,00</span>
            </div>
            {/* Pie del comprobante: CAE a la izquierda y el sello estampado a la derecha, sin tapar datos. */}
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-[11px] leading-snug text-fk-gris-texto tabular-nums">
                CAE 74212345678901
                <br />
                Vto. 07/12/2026
              </p>
              <span className="fk-ingreso-sello shrink-0 rounded-fk border-2 border-fk-ok-texto px-2 py-0.5 text-xs font-bold tracking-[0.12em] text-fk-ok-texto uppercase">
                Autorizada
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Marco del login y el registro: panel de marca (fiordo) con el tagline, una factura de ejemplo que se
 * imprime y los beneficios; y el formulario a la derecha. En mobile queda una franja con el logo.
 * Las pantallas que ven terceros (verificar recibo, acceso por enlace) siguen con MarcoPublico.
 */
export function MarcoIngreso({ titulo, bajada, children }: { titulo: string; bajada: string; children: ReactNode }) {
  return (
    // Ocupa justo el alto visible, sin scroll de página: el panel de marca se achica por partes en ventanas
    // bajas (ilustración, bajada, beneficios) y, solo en pantallas muy chicas, el formulario se desplaza
    // dentro de su panel en vez de quedar cortado.
    <main className="flex h-dvh flex-col overflow-hidden bg-fk-blanco lg:flex-row">
      {/* @container: el reparto depende del ancho del panel, no de la pantalla. */}
      <section className="@container fk-sobre-oscuro relative flex shrink-0 flex-col overflow-hidden bg-fk-fiordo px-6 py-4 text-fk-blanco-roto sm:px-10 sm:py-6 lg:h-full lg:w-[48%] lg:px-14 lg:py-10">
        <img src="/brand/faktia-horizontal-negativo.svg" alt="Faktia" className="h-7 w-auto self-start sm:h-8" />

        {/* Bloque central (título, bajada e ilustración), centrado en el alto libre: sin huecos arriba.
            Panel ancho: texto e ilustración lado a lado; angosto: uno debajo del otro, alineados a la izquierda. */}
        <div className="mt-3 flex min-h-0 items-center sm:mt-6 lg:my-6 lg:flex-1">
          <div className="grid w-full items-center gap-8 @3xl:grid-cols-[minmax(0,1fr)_auto] @3xl:gap-10">
            <div>
              <span className="hidden h-[3px] w-10 bg-fk-terracota sm:block" aria-hidden />
              <p className="max-w-md text-lg leading-tight font-semibold tracking-[-0.02em] sm:mt-4 sm:text-2xl lg:text-[40px] lg:[@media(max-height:780px)]:text-3xl">
                Facturar no debería ser un trámite.
              </p>
              <p className="mt-4 hidden max-w-md text-[15px] text-fk-blanco-roto/80 lg:block lg:[@media(max-height:620px)]:hidden">
                Facturas electrónicas, presupuestos, recibos y cuenta corriente, en un solo lugar y con tu marca.
              </p>
            </div>
            {/* La ilustración se achica por escalones según el alto (ver .fk-ingreso-escala en index.css). */}
            <div className="fk-ingreso-escala hidden justify-start lg:flex @3xl:justify-end">
              <FacturaEjemplo />
            </div>
          </div>
        </div>

        {/* Lista vertical; en ventanas bajas, una fila compacta (ver .fk-ingreso-beneficios en index.css). */}
        <ul className="fk-ingreso-beneficios hidden lg:grid">
          {BENEFICIOS.map((b) => (
            <li key={b.texto} className="flex items-center gap-3 text-sm text-fk-blanco-roto/85">
              <span className="fk-ingreso-beneficio-icono inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-fk border border-fk-blanco-roto/20">
                <b.icono className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              {b.texto}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-6 py-6 sm:px-10 sm:py-10 lg:items-center lg:py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-fk-fiordo">{titulo}</h1>
          <p className="mt-2 mb-6 text-[15px] text-fk-gris-texto sm:mb-8">{bajada}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
