import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline } from 'lucide-react';

/** Paleta corta permitida (mismos colores que el PDF; el backend sanea cualquier otro). */
const COLORES = [
  { nombre: 'Normal', valor: null, clase: 'bg-fk-grafito' },
  { nombre: 'Rojo', valor: '#A3352B', clase: 'bg-fk-error-texto' },
  { nombre: 'Azul', valor: '#1E3A4C', clase: 'bg-fk-fiordo' },
  { nombre: 'Verde', valor: '#23423A', clase: 'bg-fk-pino' },
  { nombre: 'Naranja', valor: '#A84A2C', clase: 'bg-fk-terracota-texto' },
] as const;

/**
 * Texto con formato limitado (negrita, cursiva, subrayado y la paleta corta). Devuelve el HTML del
 * editor; el backend lo sanea y guarda una versión canónica. `value` solo se aplica al montar o si
 * cambia desde afuera (por ejemplo, al elegir un ítem de la biblioteca).
 */
export function EditorTexto({
  value,
  onChange,
  placeholder,
  etiqueta,
  minAlto = 'min-h-20',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  etiqueta: string;
  minAlto?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ultimo = useRef<string | null>(null);

  useEffect(() => {
    if (ref.current && value !== ultimo.current) {
      ref.current.innerHTML = value;
      ultimo.current = value;
    }
  }, [value]);

  function emitir() {
    const html = ref.current?.innerHTML ?? '';
    ultimo.current = html;
    onChange(html);
  }

  function comando(cmd: 'bold' | 'italic' | 'underline' | 'foreColor', arg?: string) {
    ref.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, arg);
    emitir();
  }

  const boton = 'inline-flex h-8 w-8 items-center justify-center rounded-fk text-fk-gris-texto hover:bg-fk-niebla hover:text-fk-fiordo';
  return (
    <div className="rounded-fk border border-fk-borde bg-fk-blanco focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-fk-fiordo">
      <div className="flex flex-wrap items-center gap-1 border-b border-fk-borde px-1 py-1" role="toolbar" aria-label={`Formato de ${etiqueta}`}>
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
            onClick={() => comando('foreColor', c.valor ?? '#1B262D')}
          >
            <span className={`h-3.5 w-3.5 rounded-full ${c.clase}`} />
          </button>
        ))}
      </div>
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
    </div>
  );
}

/** Muestra el HTML ya saneado por el backend (solo p, b, i, u y span.c-*). */
export function TextoFormato({ html, className = '' }: { html: string; className?: string }) {
  return <div className={`fk-texto-formato text-sm ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
