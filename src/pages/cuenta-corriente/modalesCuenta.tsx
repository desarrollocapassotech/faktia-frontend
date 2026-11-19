import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { Undo2 } from 'lucide-react';
import { AlertaError, Boton, BotonIcono, Campo, Entrada, EntradaNumero, Modal, Selector } from '@/components/ui';
import { dinero, fecha, hoy } from '@/lib/formato';
import type { Moneda, MovimientoCc, TipoMovimientoCc } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

/** Invalida todo lo que muestra saldos (listado, resumen y la cuenta abierta). */
function useRefrescarCuentas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['cuenta-corriente'] });
}

/** "Factura A 00001-00000012" */
function nombreMovimiento(m: { concepto: string; numero: string | null }): string {
  return m.numero ? `${m.concepto} ${m.numero}` : m.concepto;
}

const CONCEPTOS: Record<TipoMovimientoCc, string[]> = {
  DEBE: ['Saldo inicial', 'Venta sin factura', 'Ajuste'],
  HABER: ['Cobro', 'Saldo inicial a favor', 'Ajuste a favor'],
};

/**
 * Alta o edición de un movimiento cargado a mano: saldo inicial, ajuste o venta sin factura (DEBE)
 * y cobro sin recibo o ajuste a favor (HABER). Un cobro nuevo se puede imputar en el mismo paso.
 */
export function MovimientoModal({
  clienteId,
  monedaInicial,
  movimiento,
  pendientes,
  onCerrar,
}: {
  clienteId: string;
  monedaInicial: Moneda;
  /** Con movimiento, edita; sin él, crea. */
  movimiento?: MovimientoCc;
  /** DEBE con saldo pendiente de la cuenta (para imputar un cobro nuevo). */
  pendientes: MovimientoCc[];
  onCerrar: () => void;
}) {
  const { pedir } = useApi();
  const refrescar = useRefrescarCuentas();
  const editando = Boolean(movimiento);
  const [tipo, setTipo] = useState<TipoMovimientoCc>(movimiento?.tipo ?? 'DEBE');
  const [concepto, setConcepto] = useState(movimiento?.concepto ?? CONCEPTOS.DEBE[0]);
  const [numero, setNumero] = useState(movimiento?.numero ?? '');
  const [fechaMov, setFechaMov] = useState(movimiento?.fecha ?? hoy());
  const [vencimiento, setVencimiento] = useState(movimiento?.fechaVencimiento ?? '');
  const [moneda, setMoneda] = useState<Moneda>(movimiento?.moneda ?? monedaInicial);
  const [importe, setImporte] = useState(movimiento ? String(Number(movimiento.importe)) : '');
  const [observaciones, setObservaciones] = useState(movimiento?.observaciones ?? '');
  const [imputarA, setImputarA] = useState<string[]>([]);

  const candidatos = useMemo(() => pendientes.filter((p) => p.moneda === moneda), [pendientes, moneda]);

  const guardar = useMutation({
    mutationFn: () => {
      const comunes = {
        concepto: concepto.trim(),
        numero: numero.trim() || (editando ? null : undefined),
        fecha: fechaMov,
        importe: Number(importe).toFixed(2),
        observaciones: observaciones.trim() || (editando ? null : undefined),
      };
      if (movimiento) {
        return pedir(`/cuenta-corriente/movimientos/${movimiento.id}`, 'PATCH', {
          ...comunes,
          ...(movimiento.tipo === 'DEBE' ? { fechaVencimiento: vencimiento || null } : {}),
        });
      }
      return pedir('/cuenta-corriente/movimientos', 'POST', {
        ...comunes,
        clienteId,
        tipo,
        moneda,
        ...(tipo === 'DEBE' && vencimiento ? { fechaVencimiento: vencimiento } : {}),
        ...(tipo === 'HABER' && imputarA.length ? { imputarA } : {}),
      });
    },
    onSuccess: () => {
      void refrescar();
      onCerrar();
    },
  });

  function cambiarTipo(t: TipoMovimientoCc) {
    setTipo(t);
    setConcepto(CONCEPTOS[t][0]);
    setImputarA([]);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  const importeValido = Number(importe) > 0;

  return (
    <Modal abierto titulo={editando ? 'Editar movimiento' : 'Movimiento manual'} onCerrar={() => !guardar.isPending && onCerrar()}>
      <form onSubmit={enviar} className="space-y-4">
        {!editando && (
          <Campo etiqueta="Tipo" ayuda={tipo === 'DEBE' ? 'Suma a lo que el cliente debe.' : 'Resta de lo que el cliente debe.'}>
            <Selector value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoMovimientoCc)}>
              <option value="DEBE">Debe (cargo al cliente)</option>
              <option value="HABER">Haber (cobro o crédito)</option>
            </Selector>
          </Campo>
        )}
        <Campo etiqueta="Concepto">
          <Entrada list="conceptos-cc" value={concepto} onChange={(e) => setConcepto(e.target.value)} maxLength={120} required />
          <datalist id="conceptos-cc">
            {CONCEPTOS[tipo].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fechaMov} onChange={(e) => setFechaMov(e.target.value)} required />
          </Campo>
          {tipo === 'DEBE' && (
            <Campo etiqueta="Vencimiento">
              <Entrada type="date" value={vencimiento} min={fechaMov} onChange={(e) => setVencimiento(e.target.value)} />
            </Campo>
          )}
          <Campo etiqueta="Moneda">
            <Selector value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)} disabled={editando}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Importe">
            <EntradaNumero value={importe} onValueChange={setImporte} sinNegativos required />
          </Campo>
          <Campo etiqueta="Número de comprobante" className="sm:col-span-2">
            <Entrada value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={40} placeholder="Opcional" />
          </Campo>
        </div>
        <Campo etiqueta="Observaciones">
          <Entrada value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={500} placeholder="Opcional" />
        </Campo>

        {!editando && tipo === 'HABER' && candidatos.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-semibold text-fk-grafito">Imputar a</legend>
            <p className="text-xs text-fk-gris-texto">Se cubre del más viejo al más nuevo. Lo que sobre queda a cuenta.</p>
            <ul className="max-h-48 divide-y divide-fk-borde overflow-y-auto rounded-fk border border-fk-borde text-sm">
              {candidatos.map((p) => (
                <li key={p.id}>
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-fk-niebla">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={imputarA.includes(p.id)}
                        onChange={(e) => setImputarA((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id)))}
                      />
                      <span>
                        {nombreMovimiento(p)} <span className="text-fk-gris-texto tabular-nums">{fecha(p.fecha)}</span>
                      </span>
                    </span>
                    <span className="fk-num">{dinero(p.pendiente, p.moneda)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <AlertaError error={guardar.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="secundario" cargando={guardar.isPending} disabled={!importeValido || !concepto.trim()}>
            Guardar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Imputar desde una fila: si es un cobro (HABER), se elige la factura que cancela; si es una factura
 * (DEBE), el cobro que la cancela. El importe arranca en lo máximo posible.
 */
export function ImputarModal({ movimiento, movimientos, onCerrar }: { movimiento: MovimientoCc; movimientos: MovimientoCc[]; onCerrar: () => void }) {
  const { pedir } = useApi();
  const refrescar = useRefrescarCuentas();
  const esHaber = movimiento.tipo === 'HABER';
  const candidatos = movimientos.filter((m) => m.tipo !== movimiento.tipo && m.moneda === movimiento.moneda && Number(m.pendiente) > 0);
  const [elegido, setElegido] = useState(candidatos[0]?.id ?? '');
  const otro = candidatos.find((c) => c.id === elegido);
  const maximo = otro ? Math.min(Number(movimiento.pendiente), Number(otro.pendiente)) : 0;
  const [importe, setImporte] = useState<string | null>(null);
  const valor = importe ?? (maximo ? maximo.toFixed(2) : '');

  const imputar = useMutation({
    mutationFn: () =>
      pedir('/cuenta-corriente/imputaciones', 'POST', {
        haberId: esHaber ? movimiento.id : elegido,
        debeId: esHaber ? elegido : movimiento.id,
        importe: Number(valor).toFixed(2),
      }),
    onSuccess: () => {
      void refrescar();
      onCerrar();
    },
  });

  return (
    <Modal abierto titulo={esHaber ? 'Imputar cobro' : 'Aplicar un cobro'} onCerrar={() => !imputar.isPending && onCerrar()}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          imputar.mutate();
        }}
      >
        <p className="text-sm">
          {nombreMovimiento(movimiento)}: {esHaber ? 'quedan' : 'faltan'} <strong className="tabular-nums">{dinero(movimiento.pendiente, movimiento.moneda)}</strong>
          {esHaber ? ' sin imputar.' : ' por cobrar.'}
        </p>
        {candidatos.length === 0 ? (
          <p className="text-sm text-fk-gris-texto">
            {esHaber ? 'No hay comprobantes pendientes en esta moneda.' : 'No hay cobros ni créditos a cuenta en esta moneda.'}
          </p>
        ) : (
          <>
            <ul className="max-h-60 divide-y divide-fk-borde overflow-y-auto rounded-fk border border-fk-borde text-sm">
              {candidatos.map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-fk-niebla">
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="imputar-a"
                        checked={elegido === c.id}
                        onChange={() => {
                          setElegido(c.id);
                          setImporte(null);
                        }}
                      />
                      <span>
                        {nombreMovimiento(c)} <span className="text-fk-gris-texto tabular-nums">{fecha(c.fecha)}</span>
                      </span>
                    </span>
                    <span className="fk-num">{dinero(c.pendiente, c.moneda)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <Campo etiqueta="Importe a imputar" ayuda={`Hasta ${dinero(maximo, movimiento.moneda)}.`}>
              <EntradaNumero value={valor} onValueChange={setImporte} sinNegativos required />
            </Campo>
          </>
        )}
        <AlertaError error={imputar.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar} disabled={imputar.isPending}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            variante="secundario"
            cargando={imputar.isPending}
            disabled={!otro || !(Number(valor) > 0) || Number(valor) > maximo + 0.001}
          >
            Imputar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

/** Qué cobros cancelan una factura (o a qué facturas se aplicó un cobro), con la opción de deshacer cada uno. */
export function ImputacionesModal({ movimiento, onCerrar }: { movimiento: MovimientoCc; onCerrar: () => void }) {
  const { pedir } = useApi();
  const refrescar = useRefrescarCuentas();
  const deshacer = useMutation({
    mutationFn: (id: string) => pedir(`/cuenta-corriente/imputaciones/${id}`, 'DELETE'),
    onSuccess: () => {
      void refrescar();
      onCerrar();
    },
  });

  return (
    <Modal abierto titulo={`Imputaciones de ${nombreMovimiento(movimiento)}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <ul className="divide-y divide-fk-borde rounded-fk border border-fk-borde text-sm">
          {movimiento.imputaciones.map((i) => (
            <li key={i.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
              <span>
                {nombreMovimiento(i.movimiento)} <span className="text-fk-gris-texto tabular-nums">{fecha(i.movimiento.fecha)}</span>
                {i.automatica && <span className="block text-xs text-fk-gris-texto">Imputada automáticamente</span>}
              </span>
              <span className="flex items-center gap-2">
                <span className="fk-num">{dinero(i.importe, movimiento.moneda)}</span>
                <BotonIcono
                  etiqueta="Deshacer imputación"
                  icono={Undo2}
                  peligro
                  cargando={deshacer.isPending && deshacer.variables === i.id}
                  disabled={deshacer.isPending}
                  onClick={() => deshacer.mutate(i.id)}
                />
              </span>
            </li>
          ))}
        </ul>
        <AlertaError error={deshacer.error} />
        <div className="flex justify-end">
          <Boton variante="terciario" onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/** Vencimiento de una factura o cargo (también los que salen de un comprobante emitido). */
export function VencimientoModal({ movimiento, onCerrar }: { movimiento: MovimientoCc; onCerrar: () => void }) {
  const { pedir } = useApi();
  const refrescar = useRefrescarCuentas();
  const [vencimiento, setVencimiento] = useState(movimiento.fechaVencimiento ?? '');
  const guardar = useMutation({
    mutationFn: () => pedir(`/cuenta-corriente/movimientos/${movimiento.id}`, 'PATCH', { fechaVencimiento: vencimiento || null }),
    onSuccess: () => {
      void refrescar();
      onCerrar();
    },
  });
  return (
    <Modal abierto titulo={`Vencimiento de ${nombreMovimiento(movimiento)}`} onCerrar={() => !guardar.isPending && onCerrar()}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <Campo etiqueta="Vence el" ayuda="Vacío: sin vencimiento.">
          <Entrada type="date" value={vencimiento} min={movimiento.fecha} onChange={(e) => setVencimiento(e.target.value)} />
        </Campo>
        <AlertaError error={guardar.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar} disabled={guardar.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="secundario" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

export function EliminarMovimientoModal({ movimiento, onCerrar }: { movimiento: MovimientoCc; onCerrar: () => void }) {
  const { pedir } = useApi();
  const refrescar = useRefrescarCuentas();
  const eliminar = useMutation({
    mutationFn: () => pedir(`/cuenta-corriente/movimientos/${movimiento.id}`, 'DELETE'),
    onSuccess: () => {
      void refrescar();
      onCerrar();
    },
  });
  return (
    <Modal abierto titulo="Eliminar movimiento" onCerrar={() => !eliminar.isPending && onCerrar()}>
      <div className="space-y-4 text-sm">
        <p>
          Vas a eliminar <strong>{nombreMovimiento(movimiento)}</strong> por <strong>{dinero(movimiento.importe, movimiento.moneda)}</strong>.
        </p>
        {movimiento.imputaciones.length > 0 && (
          <p className="text-fk-gris-texto">Sus imputaciones se deshacen: lo que cancelaba vuelve a quedar pendiente.</p>
        )}
        <AlertaError error={eliminar.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar} disabled={eliminar.isPending}>
            Cancelar
          </Boton>
          <Boton variante="destructivo" cargando={eliminar.isPending} onClick={() => eliminar.mutate()}>
            Eliminar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
