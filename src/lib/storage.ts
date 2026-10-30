// localStorage puede no estar disponible (modo privado, bloqueos): nunca debe romper la app.

export function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function guardar(clave: string, valor: string): void {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // sin persistencia: la sesión dura lo que dure la pestaña
  }
}

/**
 * Las claves pasaron de "facturador.*" a "faktia.*": copia los valores viejos (sesión, último número de
 * recibo, pasos del asistente) para que nadie pierda nada, y borra los viejos. Se corre una vez al iniciar.
 */
export function migrarClavesViejas(): void {
  try {
    const ls = window.localStorage;
    const viejas = Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => Boolean(k?.startsWith('facturador.')));
    for (const vieja of viejas) {
      const nueva = `faktia.${vieja.slice('facturador.'.length)}`;
      const valor = ls.getItem(vieja);
      if (valor !== null && ls.getItem(nueva) === null) ls.setItem(nueva, valor);
      ls.removeItem(vieja);
    }
  } catch {
    // almacenamiento no disponible: no hay nada que migrar
  }
}

export function borrar(clave: string): void {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    // nada que hacer
  }
}
