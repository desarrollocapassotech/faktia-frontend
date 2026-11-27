import { useLayoutEffect, useSyncExternalStore, type RefObject } from 'react';

/** Duración de un ciclo del loader (`.fk-cargador-*` en index.css): mantener las dos iguales. */
export const CICLO_CARGADOR_MS = 2800;

// El loader se ve al menos un ciclo completo sin demorar los datos: si la pantalla termina de cargar
// antes, los datos se muestran enseguida y el loader termina su ciclo en chico, en una esquina
// (<CargadorEsquina />, montado en main.tsx), desde el mismo punto de la animación.

/** Ciclo que la esquina tiene que terminar: cuándo arrancó la animación y dónde estaba el loader grande. */
export type CicloEsquina = { inicio: number; origen: DOMRect | null };

let activos = 0;
let inicioMasViejo: number | null = null;
/** Último lugar en pantalla del loader grande que se fue (desde ahí vuela a la esquina). */
let ultimoOrigen: DOMRect | null = null;
let esquina: CicloEsquina | null = null;
let timerEsquina: ReturnType<typeof setTimeout> | undefined;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

function ocultarEsquina() {
  clearTimeout(timerEsquina);
  if (esquina !== null) {
    esquina = null;
    avisar();
  }
}

/**
 * Lo usa <Cargando />: registra cuándo arrancó y, si se va antes de un ciclo, lo pasa a la esquina.
 * `ref` es el dibujo de la impresora: su lugar en pantalla al irse es el punto de partida del vuelo.
 */
export function useRegistroCargador(ref: RefObject<HTMLElement | null>): number {
  // La animación del loader grande arranca al montarse: se guarda ese instante para la esquina.
  const inicio = performance.now();
  // Efecto de layout: su limpieza corre con el elemento todavía en el DOM, así se puede medir.
  useLayoutEffect(() => {
    const elemento = ref.current;
    // Lugar al aparecer: respaldo por si al irse ya no se puede medir.
    const alAparecer = elemento?.getBoundingClientRect();
    activos++;
    inicioMasViejo = inicioMasViejo === null ? inicio : Math.min(inicioMasViejo, inicio);
    // Aparece un loader grande: la esquina sobra.
    ocultarEsquina();
    return () => {
      const rect = elemento?.getBoundingClientRect();
      ultimoOrigen = rect && rect.width > 0 ? rect : alAparecer && alAparecer.width > 0 ? alAparecer : null;
      activos--;
      // Se decide en el próximo ciclo de eventos: si enseguida se monta otro loader (cambio de pantalla,
      // o el doble montaje de StrictMode en desarrollo), no se muestra la esquina.
      setTimeout(() => {
        if (activos > 0 || inicioMasViejo === null) return;
        const arranque = inicioMasViejo;
        inicioMasViejo = null;
        const falta = CICLO_CARGADOR_MS - (performance.now() - arranque);
        if (falta <= 120) return;
        esquina = { inicio: arranque, origen: ultimoOrigen };
        avisar();
        clearTimeout(timerEsquina);
        timerEsquina = setTimeout(ocultarEsquina, falta);
      }, 0);
    };
    // Solo al montar y desmontar: `inicio` es el del primer render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return inicio;
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

/** Ciclo que la esquina tiene que terminar, o null si no hay que mostrarla. */
export function useCargadorEsquina(): CicloEsquina | null {
  return useSyncExternalStore(suscribir, () => esquina);
}
