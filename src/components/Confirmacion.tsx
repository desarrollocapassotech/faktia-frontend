import { useEffect } from 'react';
import { Boton, Modal } from '@/components/ui';
import { responderConfirmacion, useConfirmacion } from '@/lib/confirmar';

/** Diálogo de confirmación de `confirmar()` (lib/confirmar.ts). Se monta una sola vez en main.tsx. */
export function Confirmacion() {
  const pedido = useConfirmacion();

  useEffect(() => {
    if (!pedido) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') responderConfirmacion(false);
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [pedido]);

  if (!pedido) return null;
  return (
    <Modal abierto titulo={pedido.titulo} onCerrar={() => responderConfirmacion(false)}>
      <div className="space-y-5">
        {pedido.mensaje && <p className="text-sm text-fk-grafito">{pedido.mensaje}</p>}
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={() => responderConfirmacion(false)}>
            Cancelar
          </Boton>
          <Boton autoFocus variante={pedido.peligro ? 'destructivo' : 'secundario'} onClick={() => responderConfirmacion(true)}>
            {pedido.accion}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
