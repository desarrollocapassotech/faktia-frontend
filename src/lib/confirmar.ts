import { useSyncExternalStore } from 'react';

// Confirmación antes de una acción (duplicar, enviar, cambiar de estado, borrar…). Almacén global con
// una sola confirmación a la vez; la dibuja <Confirmacion /> (montado en main.tsx).
//
//   if (await confirmar({ titulo: '¿Duplicar el presupuesto?', mensaje: '…', accion: 'Duplicar' })) duplicar.mutate();

export type PedidoConfirmacion = {
  titulo: string;
  /** Qué va a pasar, en una o dos frases. */
  mensaje?: string;
  /** Texto del botón que confirma: el verbo de la acción ("Duplicar", "Enviar"). */
  accion: string;
  /** Acción destructiva o que no se puede deshacer: el botón va en rojo. */
  peligro?: boolean;
};

type Actual = PedidoConfirmacion & { resolver: (ok: boolean) => void };

let actual: Actual | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

export function confirmar(pedido: PedidoConfirmacion): Promise<boolean> {
  // Si había otra abierta, se da por cancelada.
  actual?.resolver(false);
  return new Promise((resolver) => {
    actual = { ...pedido, resolver };
    avisar();
  });
}

export function responderConfirmacion(ok: boolean) {
  const a = actual;
  actual = null;
  avisar();
  a?.resolver(ok);
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function useConfirmacion(): Actual | null {
  return useSyncExternalStore(suscribir, () => actual);
}
