import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { cerrarToast, pausarToast, reanudarToast, useToasts } from '@/lib/toasts';

/**
 * Avisos de éxito y error con forma de ticket: salen "impresos" (el papel aparece de arriba hacia
 * abajo), tienen el borde de abajo cortado en zigzag, número y hora como un comprobante, y un sello
 * que cae al final. Al cerrarse se "arrancan". Estilos y animaciones en index.css (`.fk-ticket*`).
 * Se monta una sola vez en main.tsx; los éxitos se anuncian con aria-live polite y los errores, como alerta.
 */
export function Toasts() {
  const toasts = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[400] flex flex-col items-center gap-3 p-4 sm:items-end">
      {toasts.map((t) => {
        const error = t.tipo === 'error';
        const Icono = error ? CircleAlert : CircleCheck;
        return (
          // La sombra va en el contenedor (drop-shadow): la máscara del zigzag recortaría un box-shadow.
          <div
            key={t.id}
            className={`fk-ticket-sombra pointer-events-auto w-full max-w-sm ${t.saliendo ? 'fk-ticket-salir' : ''}`}
            onMouseEnter={() => pausarToast(t.id)}
            onMouseLeave={() => reanudarToast(t.id)}
            onFocus={() => pausarToast(t.id)}
            onBlur={() => reanudarToast(t.id)}
          >
            <div role={error ? 'alert' : 'status'} className="fk-ticket relative bg-fk-blanco">
              {/* Franja superior en el color del resultado, como el encabezado de un comprobante. */}
              <div className={`h-1 ${error ? 'bg-fk-error-texto' : 'bg-fk-ok-texto'}`} aria-hidden />
              <div className="px-4 pt-3 pb-5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`flex items-center gap-1.5 fk-etiqueta ${error ? 'text-fk-error-texto' : 'text-fk-ok-texto'}`}>
                    <Icono className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    {error ? 'No se pudo' : 'Operación OK'}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-[11px] text-fk-gris-texto tabular-nums" aria-hidden>
                      N° {String(t.id).padStart(4, '0')} · {t.hora}
                    </span>
                    <button
                      type="button"
                      onClick={() => cerrarToast(t.id)}
                      aria-label="Cerrar aviso"
                      className="-mr-2 inline-flex h-8 w-8 items-center justify-center rounded-fk text-fk-gris-texto hover:bg-fk-niebla hover:text-fk-grafito"
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </button>
                  </span>
                </div>
                {/* Línea de corte punteada. */}
                <div className="my-2 border-t border-dashed border-fk-borde" aria-hidden />
                <div className="pr-20 text-sm">
                  <p className="font-semibold text-fk-grafito">{t.titulo}</p>
                  {t.descripcion && <p className="mt-0.5 break-words text-fk-gris-texto">{t.descripcion}</p>}
                </div>
              </div>
              {/* Sello de goma: cae después de que el ticket termina de "imprimirse". */}
              <span
                className={`fk-ticket-sello pointer-events-none absolute right-4 bottom-6 rounded-fk border-2 px-2 py-0.5 text-xs font-bold tracking-[0.12em] uppercase ${
                  error ? 'border-fk-error-texto text-fk-error-texto' : 'border-fk-ok-texto text-fk-ok-texto'
                }`}
                aria-hidden
              >
                {error ? 'Error' : 'Listo'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
