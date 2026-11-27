import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertaError, Aviso, Boton, Campo, Entrada, Modal } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { dinero, letraDe, numeroComprobante, tipoLargo } from '@/lib/formato';
import type { Comprobante, TipoComprobante } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { toast } from '@/lib/toasts';

export type ClaseNota = 'NOTA_CREDITO' | 'NOTA_DEBITO';

/** Confirmación de emisión (pide el CAE). Montarlo al abrir: cada apertura genera su propia clave de idempotencia. */
export function EmitirModal({
  comprobante: c,
  onCerrar,
  onActualizado,
  onRechazado,
}: {
  comprobante: Comprobante;
  onCerrar: () => void;
  onActualizado: (c: Comprobante) => void;
  /** ARCA rechazó (422): el modal se cierra y el error queda guardado en el comprobante. */
  onRechazado?: () => void;
}) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  // Una clave por confirmación. Solo se reusa si la request no llegó a tener respuesta (corte de red):
  // así reintentar no puede emitir dos veces.
  const [clave, setClave] = useState(() => crypto.randomUUID());

  const emitir = useMutation({
    meta: { error: 'No se pudo emitir el comprobante.' },
    mutationFn: () =>
      pedir<Comprobante>(`/comprobantes/${c.id}/emitir`, 'POST', { version: c.version }, { 'Idempotency-Key': clave }),
    onSuccess: (nuevo) => {
      // El mensaje depende de lo que respondió ARCA.
      if (nuevo.estado === 'EMITIDO') toast.exito('Comprobante emitido.', nuevo.cae ? `CAE ${nuevo.cae}` : undefined);
      else if (nuevo.estado === 'PENDIENTE_VERIFICACION') toast.error('ARCA no respondió a tiempo.', 'No lo vuelvas a emitir: el sistema lo verifica solo.');
      queryClient.setQueryData(['comprobante', nuevo.id], nuevo);
      void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
      onActualizado(nuevo);
      onCerrar();
    },
    onError: (err) => {
      const huboRespuesta = err instanceof ApiError && err.status !== 0;
      if (huboRespuesta) setClave(crypto.randomUUID());
      // Rechazo de ARCA (422): el comprobante ya tiene el error guardado y se muestra en el detalle.
      if (err instanceof ApiError && err.status === 422) {
        onCerrar();
        onRechazado?.();
      }
      void queryClient.invalidateQueries({ queryKey: ['comprobante', c.id] });
      void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
    },
  });

  const sinRespuesta = emitir.error instanceof ApiError && emitir.error.status === 0;
  const cerrar = () => !emitir.isPending && onCerrar();

  return (
    <Modal abierto titulo={`Emitir ${tipoLargo(c.tipo)}`} onCerrar={cerrar}>
      <div className="space-y-4 text-sm">
        <p>
          Vas a pedir el CAE a ARCA para una <strong>{tipoLargo(c.tipo)}</strong> a <strong>{c.cliente.razonSocial}</strong> por{' '}
          <strong>{dinero(c.importeTotal, c.moneda)}</strong>.
        </p>
        <p className="text-fk-gris-texto">
          Una vez autorizado no se puede modificar ni borrar: para corregirlo hay que hacer una nota de crédito.
        </p>
        {c.estado === 'RECHAZADO' && c.errorMensaje && (
          <p className="text-fk-gris-texto">Último rechazo de ARCA: {c.errorMensaje}</p>
        )}
        {c.ambiente === 'HOMOLOGACION' && (
          <Aviso>Estás en el ambiente de pruebas: el comprobante no va a tener validez fiscal.</Aviso>
        )}
        {c.advertenciaLetra && <Aviso>{c.advertenciaLetra}</Aviso>}
        {sinRespuesta ? (
          <AlertaError mensaje="No hubo respuesta del servidor. Reintentá: si la primera vez llegó a emitirse, no se duplica." />
        ) : (
          <AlertaError error={emitir.error} />
        )}
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={cerrar} disabled={emitir.isPending}>
            Cancelar
          </Boton>
          <Boton cargando={emitir.isPending} onClick={() => emitir.mutate()}>
            {sinRespuesta ? 'Reintentar' : 'Emitir'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/** Crea el borrador de una nota de crédito o débito sobre una factura y navega a él. */
export function NotaModal({
  factura,
  clase,
  onCerrar,
}: {
  factura: { id: string; tipo: TipoComprobante; numero: number | null; puntoVenta: { numero: number } };
  clase: ClaseNota;
  onCerrar: () => void;
}) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [motivo, setMotivo] = useState('');
  const texto = clase === 'NOTA_CREDITO' ? 'nota de crédito' : 'nota de débito';

  const crear = useMutation({
    meta: { exito: 'Nota creada.', error: 'No se pudo crear la nota.' },
    mutationFn: () => pedir<Comprobante>(`/comprobantes/${factura.id}/notas`, 'POST', { clase, motivo: motivo.trim() }),
    onSuccess: (n) => {
      queryClient.setQueryData(['comprobante', n.id], n);
      void queryClient.invalidateQueries({ queryKey: ['comprobante', factura.id] });
      void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
      navigate(`/comprobantes/${n.id}`);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Modal abierto titulo={`Nueva ${texto}`} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4 text-sm">
        <p>
          Se crea un borrador de {texto} {letraDe(factura.tipo)} sobre {tipoLargo(factura.tipo)}{' '}
          {numeroComprobante(factura.puntoVenta.numero, factura.numero)}, con las mismas líneas. Podés ajustar los importes antes de
          emitirla.
        </p>
        {clase === 'NOTA_CREDITO' && (
          <p className="text-fk-gris-texto">Si la nota de crédito es por el total, la factura queda anulada al emitirla.</p>
        )}
        <Campo etiqueta="Motivo">
          <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} required maxLength={500} autoFocus />
        </Campo>
        <AlertaError error={crear.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={crear.isPending}>
            Crear borrador
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
