import { useState } from 'react';

/** Orden de grillas por columna (click en el título), como en Vialto: 1er click ascendente, 2do descendente. */

export type OrdenDir = 'asc' | 'desc';
/** Qué muestra la columna: define cómo se lee el sentido del orden en el tooltip. */
export type TipoOrden = 'texto' | 'numero' | 'fecha';

export type OrdenColumna = {
  /** Dirección si esta columna es el orden aplicado; null si no lo es. */
  dir: OrdenDir | null;
  tipo?: TipoOrden;
  onClick: () => void;
  /** Con la columna activa, muestra una ✕ que vuelve al orden de siempre. */
  onClear?: () => void;
};

/** "A a Z" / "menor a mayor" / "más antigua a más reciente" (y al revés con `desc`). */
export function etiquetaDirOrden(tipo: TipoOrden, dir: OrdenDir): string {
  switch (tipo) {
    case 'numero':
      return dir === 'asc' ? 'menor a mayor' : 'mayor a menor';
    case 'fecha':
      return dir === 'asc' ? 'más antigua a más reciente' : 'más reciente a más antigua';
    default:
      return dir === 'asc' ? 'A a Z' : 'Z a A';
  }
}

/**
 * Estado del orden por columna. `orden = null`: el orden de siempre de la grilla.
 * `onCambio` corre en cada cambio (ej. volver a la página 1).
 */
export function useOrdenColumna<F extends string>(onCambio?: () => void, tipos?: Partial<Record<F, TipoOrden>>) {
  const [orden, setOrden] = useState<{ por: F; dir: OrdenDir } | null>(null);

  function cambiar(siguiente: { por: F; dir: OrdenDir } | null) {
    setOrden(siguiente);
    onCambio?.();
  }

  /** Props `orden` de `TituloOrdenable` para una columna. */
  function ordenColumna(campo: F): OrdenColumna {
    const activo = orden?.por === campo;
    return {
      dir: activo ? orden.dir : null,
      tipo: tipos?.[campo],
      onClick: () => cambiar({ por: campo, dir: activo && orden.dir === 'asc' ? 'desc' : 'asc' }),
      onClear: () => cambiar(null),
    };
  }

  return { orden, ordenColumna };
}
