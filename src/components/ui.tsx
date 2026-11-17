import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import type { Estado, Tono } from '@/lib/formato';
import { leerNumero, numeroEditable } from '@/lib/numeros';
import { claseBoton, type Variante } from './estilos';

export const claseInput =
  'min-h-10 w-full rounded-fk border border-fk-borde bg-fk-blanco px-3 py-2 text-sm text-fk-grafito placeholder:text-fk-gris-texto aria-[invalid=true]:border-fk-error-texto disabled:cursor-not-allowed disabled:bg-fk-blanco-roto disabled:text-fk-gris-texto';

/** Input de archivo: el botón nativo con forma de botón terciario. */
export const claseArchivo =
  'block w-full text-sm text-fk-gris-texto file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-fk file:border file:border-fk-fiordo file:bg-transparent file:px-4 file:text-sm file:font-semibold file:text-fk-fiordo hover:file:bg-fk-niebla';

export function Boton({
  variante = 'primario',
  cargando,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button type="button" {...props} disabled={props.disabled || cargando} className={`${claseBoton(variante)} ${className}`}>
      {cargando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  children,
  className = '',
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  /** Mensaje de error del campo; se muestra debajo, en el color de error. */
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid content-start gap-1.5 ${className}`}>
      <span className="text-[13px] font-semibold text-fk-grafito">{etiqueta}</span>
      {children}
      {error ? (
        <span className="block text-[13px] text-fk-error-texto">{error}</span>
      ) : (
        ayuda && <span className="block text-xs text-fk-gris-texto">{ayuda}</span>
      )}
    </label>
  );
}

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${claseInput} ${props.className ?? ''}`} />;
}

/** Contraseña con botón para mostrarla u ocultarla (login y registro). */
export function EntradaPassword(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [ver, setVer] = useState(false);
  const texto = ver ? 'Ocultar contraseña' : 'Mostrar contraseña';
  return (
    <span className="relative block">
      <Entrada {...props} type={ver ? 'text' : 'password'} className={`pr-11 ${props.className ?? ''}`} />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        disabled={props.disabled}
        aria-label={texto}
        aria-pressed={ver}
        title={texto}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-fk text-fk-gris-texto hover:text-fk-fiordo disabled:opacity-50"
      >
        {ver ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
      </button>
    </span>
  );
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
      className={`text-right tabular-nums ${props.className ?? ''}`}
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

/** Ruta de navegación: los ítems con `a` son links; el último es la página actual. */
export function Migas({ items }: { items: Array<{ texto: ReactNode; a?: string }> }) {
  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-fk-gris-texto">
        {items.map((m, i) => {
          const ultima = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {m.a && !ultima ? (
                <Link to={m.a} className="font-medium underline-offset-2 hover:text-fk-fiordo hover:underline">
                  {m.texto}
                </Link>
              ) : (
                <span aria-current={ultima ? 'page' : undefined} className={ultima ? 'text-fk-grafito' : ''}>
                  {m.texto}
                </span>
              )}
              {!ultima && <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Título de página con migas, descripción y acciones opcionales. */
export function EncabezadoPagina({
  titulo,
  migas,
  descripcion,
  acciones,
  junto,
}: {
  titulo: ReactNode;
  migas?: Array<{ texto: ReactNode; a?: string }>;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  /** Algo chico al lado del título (número, badge de estado). */
  junto?: ReactNode;
}) {
  return (
    <header className="space-y-2">
      {migas && <Migas items={migas} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="fk-titulo">{titulo}</h1>
          {junto}
        </div>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
      {descripcion && <p className="max-w-[var(--fk-ancho-formulario)] text-fk-gris-texto">{descripcion}</p>}
    </header>
  );
}

export function Tarjeta({ titulo, acciones, children, className = '' }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-fk border border-fk-borde bg-fk-blanco ${className}`}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-fk-borde px-4 py-4 sm:px-6">
          {titulo && <h2 className="fk-subtitulo">{titulo}</h2>}
          {acciones}
        </header>
      )}
      <div className="px-4 py-5 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
}

/** Contenedor de tabla dentro de una Tarjeta: llega a los bordes y scrollea en horizontal en pantallas chicas. */
export function ContenedorTabla({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto sm:-mx-6">{children}</div>;
}

const TONOS: Record<Tono, string> = {
  ok: 'bg-fk-ok-fondo text-fk-ok-texto',
  pendiente: 'bg-fk-pendiente-fondo text-fk-pendiente-texto',
  error: 'bg-fk-error-fondo text-fk-error-texto',
  info: 'bg-fk-info-fondo text-fk-info-texto',
};

/** Badge de estado. */
export function Etiqueta({ children, tono = 'info', tachado, className = '' }: { children: ReactNode; tono?: Tono; tachado?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-fk-badge px-2.5 py-0.5 text-xs font-semibold ${TONOS[tono]} ${tachado ? 'line-through' : ''} ${className}`}
    >
      {children}
    </span>
  );
}

export function EtiquetaEstado({ estado, className }: { estado: Estado; className?: string }) {
  return (
    <Etiqueta tono={estado.tono} tachado={estado.tachado} className={className}>
      {estado.texto}
    </Etiqueta>
  );
}

/** Error de la API: mensaje amigable + detalle técnico desplegable. */
export function AlertaError({ error, mensaje, detalle }: { error?: unknown; mensaje?: string | null; detalle?: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const texto = mensaje ?? (error instanceof ApiError || error instanceof Error ? error.message : error ? 'Ocurrió un error.' : null);
  const det = detalle ?? (error instanceof ApiError ? ((error.body as { detalle?: string } | null)?.detalle ?? null) : null);
  if (!texto) return null;
  return (
    <div role="alert" className="rounded-fk border-l-[3px] border-fk-error-texto bg-fk-error-fondo px-4 py-3 text-sm text-fk-error-texto">
      <p>{texto}</p>
      {det && (
        <div className="mt-1">
          <button type="button" className="text-xs font-medium underline" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
          </button>
          {abierto && (
            <pre className="mt-2 max-h-60 overflow-auto rounded-fk bg-fk-blanco p-2 font-mono text-xs break-all whitespace-pre-wrap text-fk-gris-texto">
              {det}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const TONOS_AVISO = {
  ambar: 'border-fk-pendiente-texto bg-fk-pendiente-fondo',
  azul: 'border-fk-info-texto bg-fk-info-fondo',
  verde: 'border-fk-ok-texto bg-fk-ok-fondo',
};

export function Aviso({ children, tono = 'ambar' }: { children: ReactNode; tono?: keyof typeof TONOS_AVISO }) {
  return <div className={`rounded-fk border-l-[3px] px-4 py-3 text-sm text-fk-grafito ${TONOS_AVISO[tono]}`}>{children}</div>;
}

export function Modal({ abierto, titulo, onCerrar, children }: { abierto: boolean; titulo: string; onCerrar: () => void; children: ReactNode }) {
  if (!abierto) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-fk-grafito/40 p-0 sm:items-center sm:p-4"
      onMouseDown={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-fk-modal bg-fk-blanco shadow-fk-modal sm:max-h-[90vh] sm:max-w-lg sm:rounded-fk-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-fk-borde py-3 pr-3 pl-4 sm:pl-6">
          <h2 className="fk-subtitulo min-w-0 truncate">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-fk text-fk-gris-texto hover:bg-fk-niebla hover:text-fk-grafito"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p role="status" className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-fk-gris-texto">
      <img src="/brand/faktia-icono.svg" alt="" className="h-8 w-8 motion-safe:animate-pulse" />
      {texto}
    </p>
  );
}

/** Estado vacío: ícono de la marca en gris, una frase corta y, si corresponde, la acción para salir de ahí. */
export function Vacio({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <img src="/brand/faktia-icono-mono.svg" alt="" className="h-10 w-10 opacity-30" />
      <p className="max-w-sm text-sm text-fk-gris-texto">{children}</p>
      {accion}
    </div>
  );
}
