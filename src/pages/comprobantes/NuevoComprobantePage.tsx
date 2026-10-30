import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { EditorComprobante } from './EditorComprobante';

export function NuevoComprobantePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-4">
      <div>
        <Link to="/comprobantes" className="text-sm text-marca hover:text-marca-claro">
          ← Comprobantes
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">Nueva factura</h1>
        <p className="text-sm text-acero">Se guarda como borrador. Lo revisás y lo emitís en el paso siguiente.</p>
      </div>
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
