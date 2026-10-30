export type Variante = 'primario' | 'secundario' | 'terciario' | 'destructivo' | 'fantasma';

const VARIANTES: Record<Variante, string> = {
  // CTA principal: uno por pantalla (el terracota no pasa del ~5%).
  primario: 'border-transparent bg-fk-terracota-texto text-fk-blanco hover:bg-fk-terracota-texto-hover',
  secundario: 'border-transparent bg-fk-fiordo text-fk-blanco hover:bg-fk-fiordo-hover',
  terciario: 'border-fk-fiordo bg-transparent text-fk-fiordo hover:bg-fk-niebla',
  destructivo: 'border-transparent bg-transparent text-fk-error-texto hover:bg-fk-error-fondo',
  // Acciones discretas dentro de filas y listas.
  fantasma: 'border-transparent bg-transparent text-fk-fiordo hover:bg-fk-niebla',
};

/** Clases de un botón, para usarlas también en algo que no es <button> (un <label> de archivo, un <Link>). */
export function claseBoton(variante: Variante = 'primario') {
  return `inline-flex min-h-10 items-center justify-center gap-2 rounded-fk border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]}`;
}
