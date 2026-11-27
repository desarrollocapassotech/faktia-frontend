import { Plus, Trash2 } from 'lucide-react';
import { Boton, BotonIcono, Entrada, EntradaNumero } from '@/components/ui';
import { dinero } from '@/lib/formato';
import type { Moneda } from '@/lib/tipos';
import { nuevoHito, sumaHitos, type HitoEditable } from './plan';

/**
 * Plan de pagos: el monto acordado dividido en hitos (anticipo, según avance, al terminar…). Un hito
 * "por certificación" cuenta en el saldo pero solo se cobra lo que se va certificando.
 */
export function EditorPlan({
  hitos,
  onCambiar,
  montoAcordado,
  moneda,
}: {
  hitos: HitoEditable[];
  onCambiar: (hitos: HitoEditable[]) => void;
  montoAcordado: string;
  moneda: Moneda;
}) {
  const total = sumaHitos(hitos);
  const acordado = Number(montoAcordado) || 0;
  const diferencia = Math.round((acordado - total) * 100) / 100;
  const cambiar = (clave: string, campo: keyof HitoEditable, valor: string | boolean) =>
    onCambiar(hitos.map((h) => (h.clave === clave ? { ...h, [campo]: valor } : h)));

  return (
    <div className="space-y-3">
      {hitos.length === 0 && <p className="text-sm text-fk-gris-texto">Sin hitos, el monto acordado queda como un único importe.</p>}
      {hitos.map((h, i) => (
        <div key={h.clave} className="grid gap-2 rounded-fk border border-fk-borde p-3 sm:grid-cols-[minmax(0,1fr)_9rem_9.5rem_auto] sm:items-center">
          <Entrada
            aria-label={`Descripción del hito ${i + 1}`}
            placeholder="Anticipo, según avance de obra, al terminar…"
            value={h.descripcion}
            onChange={(e) => cambiar(h.clave, 'descripcion', e.target.value)}
            maxLength={200}
          />
          <EntradaNumero
            aria-label={`Importe del hito ${i + 1}`}
            placeholder="Importe"
            value={h.importe}
            onValueChange={(v) => cambiar(h.clave, 'importe', v)}
            sinNegativos
            disabled={h.bloqueado}
          />
          <Entrada
            type="date"
            aria-label={`Vencimiento del hito ${i + 1}`}
            title="Vencimiento (opcional)"
            value={h.fechaVencimiento}
            onChange={(e) => cambiar(h.clave, 'fechaVencimiento', e.target.value)}
            disabled={h.porCertificacion}
          />
          <BotonIcono
            etiqueta="Quitar hito"
            icono={Trash2}
            peligro
            disabled={h.bloqueado}
            onClick={() => onCambiar(hitos.filter((x) => x.clave !== h.clave))}
          />
          <label className="flex items-center gap-2 text-sm text-fk-gris-texto sm:col-span-4">
            <input
              type="checkbox"
              checked={h.porCertificacion}
              disabled={h.bloqueado}
              onChange={(e) =>
                onCambiar(
                  hitos.map((x) =>
                    x.clave === h.clave
                      ? {
                          ...x,
                          porCertificacion: e.target.checked,
                          fechaVencimiento: '',
                        }
                      : x,
                  ),
                )
              }
            />
            Se cobra por certificación de avance (cada certificación tiene su vencimiento)
            {h.bloqueado && <span className="text-xs">· Tiene cobros: solo cambian descripción y vencimiento.</span>}
          </label>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Boton
          variante="terciario"
          onClick={() => onCambiar([...hitos, nuevoHito('', hitos.length === 0 ? montoAcordado : diferencia > 0 ? String(diferencia) : '')])}
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Agregar hito
        </Boton>
        {hitos.length > 0 && (
          <p className={`text-sm tabular-nums ${diferencia === 0 ? 'text-fk-pino' : 'text-fk-error-texto'}`}>
            Hitos: {dinero(total, moneda)}
            {diferencia !== 0 && ` · faltan ${dinero(diferencia, moneda)} para el acordado`}
          </p>
        )}
      </div>
    </div>
  );
}
