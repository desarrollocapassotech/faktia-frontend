import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { ApiError } from '@/lib/api';
import { leerNumero, numeroEditable } from '@/lib/numeros';

export const claseInput =
  'min-h-10 w-full border border-black/15 bg-white px-3 py-2 text-sm text-carbon outline-none focus:border-marca focus:ring-2 focus:ring-marca/15 disabled:bg-niebla disabled:text-acero';

/** Título de página (mismo que Vialto). */
export const claseTituloPagina = 'font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl';

/** Tablas: encabezado en el color de acento, filas compactas (patrón de listados de Vialto). */
export const claseThead =
  'bg-niebla text-left font-[family-name:var(--font-ui)] text-[13px] uppercase tracking-[0.08em] text-marca [&_th]:border-b [&_th]:border-black/10';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';
const VARIANTES: Record<Variante, string> = {
  primario: 'border border-transparent bg-carbon text-white hover:bg-grafito',
  secundario: 'border border-black/20 bg-white text-carbon hover:bg-niebla',
  peligro: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  fantasma: 'border border-transparent text-marca hover:bg-marca/10',
};

export function Boton({
  variante = 'primario',
  cargando,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || cargando}
      className={`inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    >
      {cargando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Campo({ etiqueta, ayuda, children, className = '' }: { etiqueta: string; ayuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-acero">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-xs text-acero">{ayuda}</span>}
    </label>
  );
}

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${claseInput} ${props.className ?? ''}`} />;
}

/**
 * Campo numérico en formato argentino: muestra "30.800" o "1.540,50" y se escribe con coma decimal
 * (también acepta el punto por costumbre). Devuelve el valor normalizado ("1540.5"; "" si no es un número).
 */
export function EntradaNumero({
  value,
  onValueChange,
  maxDecimales = 2,
  onFocus,
  onBlur,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string | number | null | undefined;
  onValueChange: (valor: string) => void;
  maxDecimales?: number;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  return (
    <Entrada
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={editando ?? numeroEditable(value, maxDecimales)}
      onFocus={(e) => {
        setEditando(numeroEditable(value, maxDecimales));
        onFocus?.(e);
      }}
      onChange={(e) => {
        setEditando(e.target.value);
        const n = leerNumero(e.target.value);
        onValueChange(n === null ? '' : String(n));
      }}
      onBlur={(e) => {
        setEditando(null);
        onBlur?.(e);
      }}
    />
  );
}

export function Selector(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${claseInput} ${props.className ?? ''}`} />;
}

export function Tarjeta({ titulo, acciones, children, className = '' }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded border border-black/5 bg-white ${className}`}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-4 py-3 sm:px-6">
          {titulo && <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-carbon">{titulo}</h2>}
          {acciones}
        </header>
      )}
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

/** Badge: los colores (incluido el borde) los pasa quien lo usa, ej. `border-emerald-500/80 bg-emerald-100 text-emerald-950`. */
export function Etiqueta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-wider ${className}`}
    >
      {children}
    </span>
  );
}

/** Error de la API: mensaje amigable + detalle técnico desplegable (patrón de Vialto). */
export function AlertaError({ error, mensaje, detalle }: { error?: unknown; mensaje?: string | null; detalle?: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const texto = mensaje ?? (error instanceof ApiError || error instanceof Error ? error.message : error ? 'Ocurrió un error.' : null);
  const det = detalle ?? (error instanceof ApiError ? ((error.body as { detalle?: string } | null)?.detalle ?? null) : null);
  if (!texto) return null;
  return (
    <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <p>{texto}</p>
      {det && (
        <div className="mt-1">
          <button type="button" className="text-xs underline" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
          </button>
          {abierto && (
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-white p-2 text-xs text-acero">{det}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export function Aviso({ children, tono = 'ambar' }: { children: ReactNode; tono?: 'ambar' | 'azul' | 'verde' }) {
  const clases = {
    ambar: 'border-amber-200 bg-amber-50 text-amber-950',
    azul: 'border-marca/25 bg-marca/5 text-carbon',
    verde: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  }[tono];
  return <div className={`rounded border px-3 py-2 text-sm ${clases}`}>{children}</div>;
}

export function Modal({ abierto, titulo, onCerrar, children }: { abierto: boolean; titulo: string; onCerrar: () => void; children: ReactNode }) {
  if (!abierto) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-h-[90vh] sm:max-w-lg sm:rounded"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-4 sm:px-6">
          <h2 className="min-w-0 truncate font-[family-name:var(--font-display)] text-lg tracking-wide sm:text-xl">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-xl leading-none text-acero hover:bg-niebla"
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p className="flex items-center justify-center gap-2 py-8 text-center text-sm text-acero">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-acero border-t-transparent" />
      {texto}
    </p>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-acero">{children}</p>;
}
