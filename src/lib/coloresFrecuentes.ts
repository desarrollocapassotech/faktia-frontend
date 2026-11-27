import { useSyncExternalStore } from 'react';
import { guardar, leer } from '@/lib/storage';

// Colores de texto más usados en los editores con formato, guardados en este navegador.
// Es un almacén compartido: todos los editores abiertos ven la misma lista al instante.

const CLAVE = 'faktia.coloresFrecuentes';
const MAX_GUARDADOS = 30;
const HEX = /^#[0-9a-f]{6}$/;

type Conteo = Record<string, number>;

function leerConteo(): Conteo {
  try {
    const v: unknown = JSON.parse(leer(CLAVE) ?? '{}');
    if (!v || typeof v !== 'object') return {};
    return Object.fromEntries(Object.entries(v).filter(([h, n]) => HEX.test(h) && typeof n === 'number' && n > 0)) as Conteo;
  } catch {
    return {};
  }
}

const ordenar = (c: Conteo) =>
  Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .map(([h]) => h);

let conteo = leerConteo();
let ordenados = ordenar(conteo);
const oyentes = new Set<() => void>();

/** Suma un uso del color (#rrggbb). */
export function registrarColor(hex: string) {
  const h = hex.toLowerCase();
  if (!HEX.test(h)) return;
  const nuevo = { ...conteo, [h]: (conteo[h] ?? 0) + 1 };
  // Solo se guardan los más usados, para que la lista no crezca sin fin.
  conteo = Object.fromEntries(Object.entries(nuevo).sort((a, b) => b[1] - a[1]).slice(0, MAX_GUARDADOS));
  ordenados = ordenar(conteo);
  guardar(CLAVE, JSON.stringify(conteo));
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

/** Los colores más usados, de más a menos, sin los de `excluir` (por ejemplo, los de la paleta fija). */
export function useColoresFrecuentes(excluir: readonly string[], max = 5): string[] {
  const lista = useSyncExternalStore(suscribir, () => ordenados);
  return lista.filter((h) => !excluir.includes(h)).slice(0, max);
}
