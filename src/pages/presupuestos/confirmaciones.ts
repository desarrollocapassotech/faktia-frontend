import { confirmar } from '@/lib/confirmar';
import type { EstadoPresupuesto } from '@/lib/tipos';

// Confirmaciones de las acciones importantes de un presupuesto (las usan el detalle y la lista).

type CambioEstado = Exclude<EstadoPresupuesto, 'VENCIDO'>;

export function confirmarCambioEstado(numero: string, estado: CambioEstado): Promise<boolean> {
  switch (estado) {
    case 'ENVIADO':
      return confirmar({ titulo: '¿Marcar como enviado?', mensaje: `El presupuesto ${numero} pasa a Enviado y deja de poder editarse.`, accion: 'Marcar como enviado' });
    case 'BORRADOR':
      return confirmar({ titulo: '¿Volver a borrador?', mensaje: `El presupuesto ${numero} vuelve a Borrador y se puede editar de nuevo.`, accion: 'Volver a borrador' });
    case 'ACEPTADO':
      return confirmar({ titulo: '¿Marcar como aceptado?', mensaje: `El presupuesto ${numero} queda aceptado y deja de poder editarse.`, accion: 'Marcar como aceptado' });
    case 'RECHAZADO':
      return confirmar({ titulo: '¿Marcar como rechazado?', mensaje: `El presupuesto ${numero} queda rechazado.`, accion: 'Marcar como rechazado', peligro: true });
  }
}

export function confirmarDuplicado(numero: string, reemplaza = false): Promise<boolean> {
  return reemplaza
    ? confirmar({
        titulo: '¿Duplicar y reemplazar?',
        mensaje: `Se crea un borrador nuevo con los mismos datos y el presupuesto ${numero} queda rechazado.`,
        accion: 'Duplicar y reemplazar',
        peligro: true,
      })
    : confirmar({ titulo: '¿Duplicar el presupuesto?', mensaje: `Se crea un borrador nuevo con los datos del ${numero}, número propio y fecha de hoy.`, accion: 'Duplicar' });
}

export function confirmarEliminacion(numero: string): Promise<boolean> {
  return confirmar({ titulo: '¿Eliminar el borrador?', mensaje: `El presupuesto ${numero} se borra y no se puede recuperar.`, accion: 'Eliminar', peligro: true });
}
