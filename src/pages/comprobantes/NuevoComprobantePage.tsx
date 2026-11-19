import { useQueryClient } from '@tanstack/react-query';
import { FilePlus, FileSpreadsheet } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EncabezadoPagina } from '@/components/ui';
import { CreacionMasiva } from '@/pages/importaciones/ImportacionesPage';
import { EditorComprobante } from './EditorComprobante';

const MODOS = [
  { id: 'una', texto: 'Una factura', icono: FilePlus },
  { id: 'masiva', texto: 'Crear de forma masiva', icono: FileSpreadsheet },
] as const;

export function NuevoComprobantePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const masiva = params.get('modo') === 'masiva';

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        titulo="Nueva factura"
        tituloEnBarra
        migas={[{ texto: 'Comprobantes', a: '/comprobantes' }, { texto: masiva ? 'Creación masiva' : 'Nueva factura' }]}
        descripcion=""
      />
      <div role="tablist" aria-label="Forma de crear" className="flex gap-1 overflow-x-auto border-b border-fk-borde">
        {MODOS.map((m) => {
          const activo = (m.id === 'masiva') === masiva;
          return (
            <button
              key={m.id}
              role="tab"
              type="button"
              aria-selected={activo}
              onClick={() => setParams(m.id === 'masiva' ? { modo: 'masiva' } : {}, { replace: true })}
              className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm whitespace-nowrap transition-colors ${
                activo
                  ? 'border-fk-fiordo font-semibold text-fk-fiordo'
                  : 'border-transparent font-medium text-fk-gris-texto hover:border-fk-borde hover:text-fk-grafito'
              }`}
            >
              <m.icono className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {m.texto}
            </button>
          );
        })}
      </div>
      {masiva ? (
        <CreacionMasiva />
      ) : (
        <EditorComprobante
          onGuardado={(c) => {
            queryClient.setQueryData(['comprobante', c.id], c);
            void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
            navigate(`/comprobantes/${c.id}`, { replace: true });
          }}
        />
      )}
    </div>
  );
}
