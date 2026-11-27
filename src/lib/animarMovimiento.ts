import { useCallback, useLayoutEffect, useRef } from 'react';

const DURACION_MS = 250;
const CURVA = 'cubic-bezier(0.2, 0, 0, 1)';

/**
 * Anima el cambio de orden de una lista (subir/bajar un renglón) con la técnica FLIP:
 * antes del cambio se guarda dónde está cada elemento y, ya dibujado el orden nuevo,
 * cada uno se desliza desde su lugar anterior hasta el nuevo.
 *
 * Uso:
 *   const animar = useAnimarMovimiento();
 *   <section ref={animar.ref(item.clave)}>…</section>
 *   onClick={() => { animar.capturar(); setItems(ordenNuevo); }}
 *
 * Solo anima lo que se movió entre `capturar()` y el render siguiente: tipear, agregar
 * o hacer scroll no dispara nada. Con "reducir movimiento" en el sistema, no anima.
 */
export function useAnimarMovimiento() {
  const nodos = useRef(new Map<string, HTMLElement>());
  const antes = useRef<Map<string, number> | null>(null);
  const callbacks = useRef(new Map<string, (el: HTMLElement | null) => void>());

  useLayoutEffect(() => {
    const posiciones = antes.current;
    if (!posiciones) return;
    antes.current = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    nodos.current.forEach((el, clave) => {
      const previa = posiciones.get(clave);
      if (previa === undefined) return;
      const dy = previa - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: DURACION_MS, easing: CURVA });
    });
  });

  /** Llamar justo antes de cambiar el orden. */
  const capturar = useCallback(() => {
    const posiciones = new Map<string, number>();
    nodos.current.forEach((el, clave) => posiciones.set(clave, el.getBoundingClientRect().top));
    antes.current = posiciones;
  }, []);

  /** Ref para el elemento de cada renglón, identificado por su clave estable (la misma del `key`). */
  const ref = useCallback((clave: string) => {
    let cb = callbacks.current.get(clave);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if (el) nodos.current.set(clave, el);
        else {
          nodos.current.delete(clave);
          callbacks.current.delete(clave);
        }
      };
      callbacks.current.set(clave, cb);
    }
    return cb;
  }, []);

  return { capturar, ref };
}
