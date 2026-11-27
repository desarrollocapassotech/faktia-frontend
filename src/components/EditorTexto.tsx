import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Palette, Underline } from 'lucide-react';
import { registrarColor, useColoresFrecuentes } from '@/lib/coloresFrecuentes';

/** Paleta fija (los colores de marca, iguales en el PDF). "Normal" vuelve al color del texto. */
const COLORES = [
  { nombre: 'Normal', valor: '#1b262d', clase: 'bg-fk-grafito' },
  { nombre: 'Rojo', valor: '#a3352b', clase: 'bg-fk-error-texto' },
  { nombre: 'Azul', valor: '#1e3a4c', clase: 'bg-fk-fiordo' },
  { nombre: 'Verde', valor: '#23423a', clase: 'bg-fk-pino' },
  { nombre: 'Naranja', valor: '#a84a2c', clase: 'bg-fk-terracota-texto' },
] as const;
const VALORES_PALETA = COLORES.map((c) => c.valor);

/**
 * Texto con formato limitado (negrita, cursiva, subrayado y color). Además de la paleta fija se puede
 * elegir cualquier color, y los más usados aparecen al lado. Devuelve el HTML del editor; el backend
 * lo sanea y guarda una versión canónica. `value` solo se aplica al montar o si cambia desde afuera
 * (por ejemplo, al elegir un ítem de la biblioteca).
 */
export function EditorTexto({
  value,
  onChange,
  placeholder,
  etiqueta,
  minAlto = 'min-h-20',
  rotulo,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  etiqueta: string;
  minAlto?: string;
  /** Rótulo visible del campo: la barra de formato se muestra a su lado en vez de dentro del recuadro. */
  rotulo?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ultimo = useRef<string | null>(null);
  // Última selección dentro del editor: el selector de color del sistema se lleva el foco, y al volver
  // hay que aplicar el color sobre lo que estaba marcado.
  const seleccion = useRef<Range | null>(null);
  const [colorLibre, setColorLibre] = useState('#0080ff');
  const frecuentes = useColoresFrecuentes(VALORES_PALETA);

  useEffect(() => {
    if (ref.current && value !== ultimo.current) {
      ref.current.innerHTML = value;
      ultimo.current = value;
    }
  }, [value]);

  useEffect(() => {
    function alCambiar() {
      const s = window.getSelection();
      if (s && s.rangeCount && ref.current?.contains(s.anchorNode)) seleccion.current = s.getRangeAt(0).cloneRange();
    }
    document.addEventListener('selectionchange', alCambiar);
    return () => document.removeEventListener('selectionchange', alCambiar);
  }, []);

  function emitir() {
    const html = ref.current?.innerHTML ?? '';
    ultimo.current = html;
    onChange(html);
  }

  function comando(cmd: 'bold' | 'italic' | 'underline' | 'foreColor', arg?: string) {
    ref.current?.focus();
    const s = window.getSelection();
    if (seleccion.current && s && !(s.rangeCount && ref.current?.contains(s.anchorNode))) {
      s.removeAllRanges();
      s.addRange(seleccion.current);
    }
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, arg);
    emitir();
  }

  function color(hex: string) {
    const h = hex.toLowerCase();
    comando('foreColor', h);
    if (!VALORES_PALETA.includes(h as (typeof VALORES_PALETA)[number])) registrarColor(h);
  }

  // El color libre se aplica al cerrar el selector del sistema (evento nativo "change"; el onChange de
  // React corre en cada movimiento y sumaría un uso por cada tono que se pasa).
  const selectorRef = useRef<HTMLInputElement>(null);
  const aplicarLibre = useRef(color);
  aplicarLibre.current = color;
  useEffect(() => {
    const input = selectorRef.current;
    if (!input) return;
    const alCerrar = () => aplicarLibre.current(input.value);
    input.addEventListener('change', alCerrar);
    return () => input.removeEventListener('change', alCerrar);
  }, []);

  // Con `rotulo`, la barra va en la línea del rótulo (botones de 28 px, que no agrandan esa línea);
  // sin él, dentro del recuadro, arriba del texto.
  const boton = `inline-flex ${rotulo ? 'h-7 w-7' : 'h-8 w-8'} items-center justify-center rounded-fk text-fk-gris-texto hover:bg-fk-niebla hover:text-fk-fiordo`;
  const barra = (
    <div className={rotulo ? '-my-1 flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' :'flex flex-wrap items-center gap-1 border-b border-fk-borde px-1 py-1'} role="toolbar" aria-label={`Formato de ${etiqueta}`}>
        <button type="button" className={boton} title="Negrita" aria-label="Negrita" onMouseDown={(e) => e.preventDefault()} onClick={() => comando('bold')}>
          <Bold className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button type="button" className={boton} title="Cursiva" aria-label="Cursiva" onMouseDown={(e) => e.preventDefault()} onClick={() => comando('italic')}>
          <Italic className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button type="button" className={boton} title="Subrayado" aria-label="Subrayado" onMouseDown={(e) => e.preventDefault()} onClick={() => comando('underline')}>
          <Underline className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <span className="mx-1 h-5 w-px bg-fk-borde" aria-hidden />
        {COLORES.map((c) => (
          <button
            key={c.nombre}
            type="button"
            className={boton}
            title={`Color: ${c.nombre.toLowerCase()}`}
            aria-label={`Color ${c.nombre.toLowerCase()}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => color(c.valor)}
          >
            <span className={`h-3.5 w-3.5 rounded-full ${c.clase}`} />
          </button>
        ))}
        {frecuentes.length > 0 && <span className="mx-1 h-5 w-px bg-fk-borde" aria-hidden />}
        {frecuentes.map((hex) => (
          <button
            key={hex}
            type="button"
            className={boton}
            title={`Color usado: ${hex}`}
            aria-label={`Color ${hex}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => color(hex)}
          >
            {/* Color elegido por la persona (dato, no estilo de la app): va en línea. */}
            <span className="h-3.5 w-3.5 rounded-full border border-fk-borde" style={{ backgroundColor: hex }} />
          </button>
        ))}
        {/* Cualquier color: el selector del sistema, invisible encima del ícono. */}
        <label className={`${boton} relative cursor-pointer focus-within:outline-2 focus-within:outline-fk-fiordo`} title="Elegir otro color">
          <Palette className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          <input ref={selectorRef} type="color" value={colorLibre} onChange={(e) => setColorLibre(e.target.value)} aria-label="Elegir otro color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
    </div>
  );
  const texto = (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="true"
      aria-label={etiqueta}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={emitir}
      onBlur={emitir}
      className={`fk-texto-formato ${minAlto} px-3 py-2 text-sm text-fk-grafito outline-none empty:before:text-fk-placeholder empty:before:content-[attr(data-placeholder)]`}
    />
  );
  const recuadro = 'rounded-fk border border-fk-borde bg-fk-blanco focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-fk-fiordo';

  if (rotulo) {
    // Mismo espaciado que `Campo`, para alinear con los campos vecinos.
    return (
      <div className="grid content-start gap-1.5">
        <div className="flex h-5 items-center gap-3">
          <span className="cursor-text text-[13px] font-semibold text-fk-grafito" onClick={() => ref.current?.focus()}>
            {rotulo}
          </span>
          {barra}
        </div>
        <div className={recuadro}>{texto}</div>
      </div>
    );
  }
  return (
    <div className={recuadro}>
      {barra}
      {texto}
    </div>
  );
}

/** Muestra el HTML ya saneado por el backend (solo p, b, i, u y span.c-*). */
export function TextoFormato({ html, className = '' }: { html: string; className?: string }) {
  return <div className={`fk-texto-formato text-sm ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
