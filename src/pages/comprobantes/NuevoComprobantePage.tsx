import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { EncabezadoPagina } from '@/components/ui';
import { EditorComprobante } from './EditorComprobante';

export function NuevoComprobantePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        titulo="Nueva factura"
        migas={[{ texto: 'Comprobantes', a: '/comprobantes' }, { texto: 'Nueva factura' }]}
        descripcion="Se guarda como borrador. Lo revisás y lo emitís en el paso siguiente."
      />
      <EditorComprobante
        onGuardado={(c) => {
          queryClient.setQueryData(['comprobante', c.id], c);
          void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
          navigate(`/comprobantes/${c.id}`, { replace: true });
        }}
      />
    </div>
  );
}
