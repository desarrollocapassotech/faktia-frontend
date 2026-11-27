import { useSyncExternalStore } from 'react';

/**
 * Mensajes de cada mutación (ver main.tsx):
 * - `exito`: toast verde al terminar bien. Sin él, no hay toast de éxito.
 * - `error`: título del toast rojo; abajo va el mensaje de la API. Sin él, el título es el mensaje
 *   de la API. `false`: sin toast (cuando el error ya se maneja de otra forma).
 */
export type MensajesMutacion = { exito?: string; error?: string | false };

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: MensajesMutacion;
  }
}

// Avisos breves (toasts) de éxito y error. Almacén global: se pueden disparar desde cualquier lado,
// también fuera de React (por ejemplo, desde el MutationCache de main.tsx).

export type TipoToast = 'exito' | 'error';
export type Toast = {
  id: number;
  tipo: TipoToast;
  titulo: string;
  descripcion?: string;
  /** Hora de emisión, impresa en el ticket. */
  hora: string;
  /** Se está yendo (animación de "arrancar el ticket"); se borra al terminar. */
  saliendo?: boolean;
};

const DURACION_MS: Record<TipoToast, number> = { exito: 4500, error: 8000 };
const SALIDA_MS = 220;
const MAX_VISIBLES = 4;

let lista: Toast[] = [];
let siguienteId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

function quitar(id: number) {
  lista = lista.filter((t) => t.id !== id);
  avisar();
}

export function cerrarToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  const t = lista.find((x) => x.id === id);
  if (!t || t.saliendo) return;
  const sinAnimacion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (sinAnimacion) return quitar(id);
  lista = lista.map((x) => (x.id === id ? { ...x, saliendo: true } : x));
  avisar();
  setTimeout(() => quitar(id), SALIDA_MS);
}

function mostrar(tipo: TipoToast, titulo: string, descripcion?: string) {
  // Si se repite el mismo aviso (doble click, reintento), no se apila: se reemplaza.
  const repetido = lista.find((t) => !t.saliendo && t.tipo === tipo && t.titulo === titulo && t.descripcion === descripcion);
  if (repetido) quitar(repetido.id);
  const id = siguienteId++;
  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  lista = [...lista, { id, tipo, titulo, descripcion, hora }].slice(-MAX_VISIBLES);
  timers.set(
    id,
    setTimeout(() => cerrarToast(id), DURACION_MS[tipo]),
  );
  avisar();
}

/** Pausa el cierre automático mientras el mouse o el foco están sobre el aviso. */
export function pausarToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}
export function reanudarToast(id: number) {
  const t = lista.find((x) => x.id === id);
  if (t && !timers.has(id)) timers.set(id, setTimeout(() => cerrarToast(id), DURACION_MS[t.tipo]));
}

export const toast = {
  exito: (titulo: string, descripcion?: string) => mostrar('exito', titulo, descripcion),
  error: (titulo: string, descripcion?: string) => mostrar('error', titulo, descripcion),
};

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(suscribir, () => lista);
}
