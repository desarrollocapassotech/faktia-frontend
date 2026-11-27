import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as EventoTeclado,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, CircleHelp, Eye, EyeOff, FlaskConical, X, type LucideIcon } from 'lucide-react';
import { ApiError } from '@/lib/api';
import type { Estado, Tono } from '@/lib/formato';
import { etiquetaDirOrden, type OrdenColumna } from '@/lib/orden';
import { leerNumero, numeroEditable } from '@/lib/numeros';
import { claseBoton, type Variante } from './estilos';

export const claseInput =
  'min-h-10 w-full rounded-fk border border-fk-borde bg-fk-blanco px-3 py-2 text-sm text-fk-grafito placeholder:text-fk-placeholder aria-[invalid=true]:border-fk-error-texto disabled:cursor-not-allowed disabled:bg-fk-blanco-roto disabled:text-fk-gris-texto';

/** Mismo input, con el texto en color de placeholder (select sin elegir, fecha vacía). */
const claseInputVacio = claseInput.replace('text-fk-grafito', 'text-fk-placeholder');

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

/** Botón cuadrado con solo un ícono (acciones de una fila). `etiqueta` va como tooltip y para lectores de pantalla. */
export function BotonIcono({
  etiqueta,
  icono: Icono,
  peligro,
  cargando,
  className = '',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  etiqueta: string;
  icono: LucideIcon;
  /** Acción destructiva (quitar, eliminar): se pinta de rojo al pasar el mouse. */
  peligro?: boolean;
  cargando?: boolean;
}) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      {...props}
      disabled={props.disabled || cargando}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-fk border border-fk-borde transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${
        peligro
          ? 'text-fk-gris-texto hover:border-fk-error-texto/40 hover:bg-fk-error-fondo hover:text-fk-error-texto'
          : 'text-fk-fiordo hover:bg-fk-niebla'
      } ${className}`}
    >
      {cargando ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Icono className="h-4 w-4" strokeWidth={1.75} />
      )}
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

/** Fecha u hora sin valor: el navegador muestra "dd/mm/aaaa", que tiene que verse como placeholder. */
const TIPOS_CON_MASCARA = ['date', 'time', 'datetime-local', 'month'];

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  const vacia = TIPOS_CON_MASCARA.includes(props.type ?? '') && (props.value === '' || props.value == null);
  return <input {...props} className={`${vacia ? claseInputVacio : claseInput} ${props.className ?? ''}`} />;
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
  sinNegativos,
  onFocus,
  onBlur,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string | number | null | undefined;
  onValueChange: (valor: string) => void;
  maxDecimales?: number;
  /** Solo cifras, punto y coma: no se puede escribir el signo menos ni letras. */
  sinNegativos?: boolean;
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
        const texto = sinNegativos ? e.target.value.replace(/[^\d.,]/g, '') : e.target.value;
        setEditando(texto);
        const n = leerNumero(texto);
        onValueChange(n === null ? '' : String(n));
      }}
      onBlur={(e) => {
        setEditando(null);
        onBlur?.(e);
      }}
    />
  );
}

/** Sin nada elegido (`value=""`: "Elegí…", "Todos"), el texto se ve como placeholder; las opciones de la lista, normales. */
export function Selector(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const vacio = props.value === '';
  return <select {...props} className={`${vacio ? claseInputVacio : claseInput} [&>option]:text-fk-grafito ${props.className ?? ''}`} />;
}

/** Sin acentos ni mayúsculas: "Martín" se encuentra escribiendo "martin". */
const normalizarBusqueda = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Select con buscador (combobox) para listas largas, como el de Vialto. `value: ""` es "sin elegir"
 * (la primera opción, con el texto de `placeholder`). Flechas para moverse, Enter elige, Escape cierra.
 */
export function SelectorBuscable({
  value,
  onChange,
  opciones,
  placeholder = 'Todos',
  placeholderBusqueda = 'Buscar…',
  'aria-label': ariaLabel,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  opciones: Array<{ value: string; label: string }>;
  placeholder?: string;
  placeholderBusqueda?: string;
  'aria-label'?: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [activa, setActiva] = useState(0);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const idLista = useId();

  // La primera fila es "sin elegir"; después, las opciones que coinciden con lo buscado.
  const filas = useMemo(() => {
    const q = normalizarBusqueda(busqueda.trim());
    const filtradas = q ? opciones.filter((o) => normalizarBusqueda(o.label).includes(q)) : opciones;
    return [{ value: '', label: placeholder }, ...filtradas];
  }, [opciones, busqueda, placeholder]);

  useLayoutEffect(() => {
    if (!abierto) return;
    function ubicar() {
      const r = botonRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 240) });
    }
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => {
      window.removeEventListener('resize', ubicar);
      window.removeEventListener('scroll', ubicar, true);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (botonRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      cerrar();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [abierto]);

  // Mantener visible la opción marcada con el teclado.
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-indice="${activa}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activa]);

  function abrir() {
    setBusqueda('');
    setActiva(Math.max(0, filas.findIndex((f) => f.value === value)));
    setAbierto(true);
  }

  function cerrar(devolverFoco = false) {
    setAbierto(false);
    setPos(null);
    if (devolverFoco) botonRef.current?.focus();
  }

  function elegir(v: string) {
    onChange(v);
    cerrar(true);
  }

  function onTecla(e: EventoTeclado<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiva((i) => Math.min(filas.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiva((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const fila = filas[activa];
      if (fila) elegir(fila.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cerrar(true);
    }
  }

  const elegida = opciones.find((o) => o.value === value);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={ariaLabel}
        onClick={() => (abierto ? cerrar() : abrir())}
        className={`${claseInput} flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`min-w-0 truncate ${elegida ? '' : 'text-fk-placeholder'}`}>{elegida?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-fk-gris-texto" strokeWidth={2} aria-hidden />
      </button>
      {abierto &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[300] rounded-fk border border-fk-borde bg-fk-blanco py-1 shadow-lg"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <div className="border-b border-fk-borde px-2 pt-1 pb-2">
              <input
                type="search"
                autoFocus
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setActiva(0);
                }}
                onKeyDown={onTecla}
                placeholder={placeholderBusqueda}
                aria-label={placeholderBusqueda}
                role="combobox"
                aria-expanded
                aria-controls={idLista}
                aria-activedescendant={`${idLista}-${activa}`}
                className={`${claseInput} min-h-9 py-1.5`}
              />
            </div>
            <ul ref={listaRef} id={idLista} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {filas.map((f, i) => (
                <li
                  key={f.value || '__todos'}
                  id={`${idLista}-${i}`}
                  data-indice={i}
                  role="option"
                  aria-selected={f.value === value}
                  onMouseEnter={() => setActiva(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir(f.value)}
                  className={`cursor-pointer px-3 py-2 text-sm ${i === activa ? 'bg-fk-niebla' : ''} ${
                    f.value === value ? 'font-semibold text-fk-fiordo' : 'text-fk-grafito'
                  } ${f.value === '' ? 'text-fk-gris-texto' : ''}`}
                >
                  {f.label}
                </li>
              ))}
              {filas.length === 1 && busqueda.trim() && <li className="px-3 py-2 text-xs text-fk-gris-texto">No hay resultados.</li>}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}

export type FiltroAplicado = { id: string; titulo: string; valor: string; quitar: () => void };

/**
 * Un badge por filtro aplicado ("Herman Alexis Nahuel ✕"; el nombre del filtro va en el tooltip) y,
 * al final, "Limpiar filtros". Sin filtros no ocupa lugar.
 */
export function FiltrosAplicados({ filtros, onLimpiar }: { filtros: FiltroAplicado[]; onLimpiar: () => void }) {
  if (filtros.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros aplicados">
      {filtros.map((f) => (
        <span
          key={f.id}
          className="inline-flex max-w-full items-center gap-1 rounded-fk-badge border border-fk-terracota-texto/30 bg-fk-terracota-texto/[0.06] py-1 pr-1 pl-3 text-xs text-fk-grafito"
        >
          <span className="truncate" title={f.titulo}>
            <span className="text-fk-gris-texto">{f.titulo}:</span> <span className="font-medium">{f.valor}</span>
          </span>
          <button
            type="button"
            onClick={f.quitar}
            aria-label={`Quitar filtro: ${f.titulo} ${f.valor}`}
            title="Quitar filtro"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-fk-gris-texto transition-colors hover:bg-fk-terracota-texto hover:text-fk-blanco"
          >
            <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onLimpiar}
        className="inline-flex h-7 shrink-0 items-center gap-1 px-2 text-xs text-fk-gris-texto underline-offset-4 transition-colors hover:text-fk-fiordo hover:underline"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Limpiar filtros
      </button>
    </div>
  );
}

/** Ruta de navegación: los ítems con `a` son links; el último es la página actual. */
export function Migas({ items }: { items: Array<{ texto: ReactNode; a?: string }> }) {
  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-fk-gris-texto">
        {items.map((m, i) => {
          const ultima = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {m.a && !ultima ? (
                <Link to={m.a} className="font-medium underline-offset-2 hover:text-fk-fiordo hover:underline">
                  {m.texto}
                </Link>
              ) : (
                <span aria-current={ultima ? 'page' : undefined} className={ultima ? 'text-base font-semibold text-fk-fiordo tabular-nums' : ''}>
                  {m.texto}
                </span>
              )}
              {!ultima && <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Id del lugar en la barra superior (AppLayout) donde se muestran las migas de la página. */
export const ID_BARRA_MIGAS = 'fk-barra-migas';

/** Las migas van en la barra superior; si la página no está dentro del AppLayout, quedan arriba del título. */
function MigasEnBarra({ items, extra }: { items: Array<{ texto: ReactNode; a?: string }>; extra?: ReactNode }) {
  // undefined: todavía no se buscó el destino (no se pinta nada, para no saltar de lugar).
  const [destino, setDestino] = useState<HTMLElement | null | undefined>(undefined);
  useEffect(() => setDestino(document.getElementById(ID_BARRA_MIGAS)), []);
  if (destino === undefined) return null;
  const contenido = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Migas items={items} />
      {extra}
    </div>
  );
  return destino ? createPortal(contenido, destino) : contenido;
}

/** Título de página con migas, descripción y acciones opcionales. */
export function EncabezadoPagina({
  titulo,
  migas,
  descripcion,
  acciones,
  junto,
  tituloEnBarra,
}: {
  titulo: ReactNode;
  migas?: Array<{ texto: ReactNode; a?: string }>;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  /** Algo chico al lado del título (número, badge de estado). */
  junto?: ReactNode;
  /**
   * La última miga ya dice qué es la página (ej. "Factura C 00002-00000002"): el título no se repite
   * en la página (queda solo para lectores de pantalla) y `junto` va en la barra, al lado de las migas.
   */
  tituloEnBarra?: boolean;
}) {
  if (tituloEnBarra) {
    return (
      <header className={descripcion || acciones ? 'flex flex-wrap items-center justify-between gap-4' : 'contents'}>
        {/* Sin migas (página de primer nivel), el título solo es la "miga". */}
        <MigasEnBarra items={migas ?? [{ texto: titulo }]} extra={junto} />
        <h1 className="sr-only">{titulo}</h1>
        {descripcion && <p className="max-w-[var(--fk-ancho-formulario)] text-fk-gris-texto">{descripcion}</p>}
        {acciones && <div className="ml-auto flex flex-wrap gap-2">{acciones}</div>}
      </header>
    );
  }
  return (
    <header className="space-y-2">
      {migas && <MigasEnBarra items={migas} />}
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

/**
 * Título de columna que ordena al hacer click (1ro ascendente, 2do descendente). La columna activa lleva la
 * flecha en terracota y una ✕ para quitar el orden; las demás, las dos flechas tenues.
 */
export function TituloOrdenable({ titulo, orden }: { titulo: string; orden: OrdenColumna }) {
  const Flecha = orden.dir === 'desc' ? ArrowDown : orden.dir === 'asc' ? ArrowUp : ArrowUpDown;
  // El tooltip describe lo que hace el próximo click.
  const siguiente = etiquetaDirOrden(orden.tipo ?? 'texto', orden.dir === 'asc' ? 'desc' : 'asc');
  const texto = `Ordenar por ${titulo.toLowerCase()} (${siguiente})`;
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={orden.onClick}
        title={texto}
        aria-label={texto}
        className="group inline-flex items-center gap-1 uppercase hover:text-fk-fiordo"
      >
        <span>{titulo}</span>
        <Flecha
          className={`h-3.5 w-3.5 shrink-0 ${orden.dir ? 'text-fk-terracota-texto' : 'text-fk-gris-texto/30 group-hover:text-fk-gris-texto/70'}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {orden.dir && orden.onClear && (
        <button
          type="button"
          onClick={orden.onClear}
          title={`Quitar orden: ${titulo.toLowerCase()}`}
          aria-label={`Quitar orden: ${titulo.toLowerCase()}`}
          className="rounded p-0.5 text-fk-gris-texto transition-colors hover:bg-fk-niebla hover:text-fk-terracota-texto"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </span>
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

/** Badge ámbar con matraz para lo emitido en homologación (sin validez fiscal). No muestra nada en producción. */
export function EtiquetaPrueba({
  ambiente,
  texto = 'Prueba',
  soloIcono,
  className = '',
}: {
  ambiente: string;
  texto?: string;
  /** Solo el matraz, con tooltip (grillas). */
  soloIcono?: boolean;
  className?: string;
}) {
  if (ambiente !== 'HOMOLOGACION') return null;
  const titulo = 'Emitido en el ambiente de pruebas de ARCA (homologación): sin validez fiscal.';
  if (soloIcono) {
    return (
      <span title={titulo} aria-label="Ambiente de pruebas" role="img" className={`inline-flex shrink-0 items-center text-fk-pendiente-texto ${className}`}>
        <FlaskConical className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
    );
  }
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-fk-badge border border-fk-pendiente-texto/30 bg-fk-pendiente-fondo px-2 py-0.5 text-xs font-semibold text-fk-pendiente-texto ${className}`}
    >
      <FlaskConical className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      {texto}
    </span>
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
  // El portal saca el modal del DOM del formulario de la página, pero los eventos de React
  // siguen subiendo por el árbol de componentes: sin cortar el submit, enviar un formulario
  // del modal (ej.: alta de cliente) también enviaría el de la página que lo abrió.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-fk-grafito/40 p-0 sm:items-center sm:p-4"
      onMouseDown={onCerrar}
      onSubmit={(e) => e.stopPropagation()}
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

/**
 * Ícono sutil de ayuda que abre un globito con la explicación. Para sacar texto de la pantalla y
 * dejarlo a mano para quien lo necesite. Se cierra con Escape, con un click afuera o tocándolo de nuevo.
 */
export function Ayuda({ children, etiqueta = 'Ayuda', className = '' }: { children: ReactNode; etiqueta?: string; className?: string }) {
  const [abierta, setAbierta] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierta) return;
    function fuera(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setAbierta(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierta(false);
    }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierta]);

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-controls={id}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-fk-niebla hover:text-fk-fiordo ${
          abierta ? 'bg-fk-niebla text-fk-fiordo' : 'text-fk-gris-texto'
        }`}
      >
        <CircleHelp className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
      {abierta && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-full left-1/2 z-40 mt-1.5 block w-72 max-w-[80vw] -translate-x-1/2 rounded-fk border border-fk-borde bg-fk-blanco p-3 text-left text-[13px] leading-relaxed font-normal text-fk-grafito shadow-fk-modal"
        >
          {children}
        </span>
      )}
    </span>
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
