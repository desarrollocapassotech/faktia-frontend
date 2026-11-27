import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { History, KeyRound, Pause, Play, RotateCw, Send, Trash2 } from 'lucide-react';
import { AlertaError, Aviso, Boton, BotonIcono, Campo, Cargando, Entrada, Etiqueta, Modal, Tarjeta, Vacio } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { fechaHora, type Tono } from '@/lib/formato';
import { useApi } from '@/lib/useApi';
import { toast } from '@/lib/toasts';

const EVENTOS: Record<string, string> = {
  'comprobante.emitido': 'Comprobante emitido (con CAE)',
  'comprobante.rechazado': 'Comprobante rechazado por ARCA',
  'importacion.confirmada': 'Importación confirmada',
};

interface Suscripcion {
  id: string;
  url: string;
  eventos: string[];
  activa: boolean;
  createdAt: string;
}

interface Entrega {
  id: string;
  eventoId: string;
  evento: string;
  estado: 'PENDIENTE' | 'ENTREGADA' | 'FALLIDA';
  intentos: number;
  proximoIntento: string;
  ultimoStatus: number | null;
  ultimoError: string | null;
  createdAt: string;
  entregadaEn: string | null;
}

const ESTADO_ENTREGA: Record<Entrega['estado'], Tono> = {
  PENDIENTE: 'pendiente',
  ENTREGADA: 'ok',
  FALLIDA: 'error',
};

/** La documentación se sirve desde el backend (misma base que la API, sin /api). */
export const URL_DOCS = `${API_URL.replace(/\/+$/, '')}/docs`;

export function WebhooksSeccion() {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [secreto, setSecreto] = useState<string | null>(null);
  const [viendo, setViendo] = useState<Suscripcion | null>(null);
  const { data, error } = useQuery({ queryKey: ['webhooks'], queryFn: () => pedir<Suscripcion[]>('/configuracion/webhooks') });
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['webhooks'] });

  const alternar = useMutation({
    meta: { error: 'No se pudo cambiar el webhook.' },
    mutationFn: (s: Suscripcion) => pedir(`/configuracion/webhooks/${s.id}`, 'PATCH', { activa: !s.activa }),
    onSuccess: (_r, s) => {
      toast.exito(s.activa ? 'Webhook pausado.' : 'Webhook activado.');
      refrescar();
    },
  });
  const eliminar = useMutation({ meta: { exito: 'Webhook eliminado.', error: 'No se pudo eliminar el webhook.' }, mutationFn: (s: Suscripcion) => pedir(`/configuracion/webhooks/${s.id}`, 'DELETE'), onSuccess: refrescar });
  const rotar = useMutation({
    meta: { exito: 'Secreto rotado.', error: 'No se pudo rotar el secreto.' },
    mutationFn: (s: Suscripcion) => pedir<{ secreto: string }>(`/configuracion/webhooks/${s.id}/rotar-secreto`, 'POST'),
    onSuccess: (r) => setSecreto(r.secreto),
  });
  const probar = useMutation({ meta: { error: 'No se pudo probar el webhook.' }, mutationFn: (s: Suscripcion) => pedir<{ ok: boolean; status: number | null; error: string | null }>(`/configuracion/webhooks/${s.id}/probar`, 'POST'),
    onSuccess: (r) =>
      r.ok
        ? toast.exito('El webhook respondió bien.', r.status ? `HTTP ${r.status}` : undefined)
        : toast.error('El webhook no respondió bien.', r.error ?? (r.status ? `HTTP ${r.status}` : undefined)),
  });

  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Webhooks">
        <p className="mb-3 text-sm text-fk-gris-texto">
          Avisan a otro sistema cuando pasa algo (por ejemplo, cuando se emite un comprobante). Cada envío va firmado con HMAC; cómo
          verificarlo está en la{' '}
          <a href={URL_DOCS} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
            documentación de la API
          </a>
          .
        </p>
        {data.length === 0 ? (
          <Vacio>Todavía no hay webhooks.</Vacio>
        ) : (
          <ul className="divide-y divide-fk-borde text-sm">
            {data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="break-all font-mono text-xs">{s.url}</p>
                  <p className="text-xs text-fk-gris-texto">{s.eventos.map((e) => EVENTOS[e] ?? e).join(' · ')}</p>
                  {!s.activa && <Etiqueta>Pausado</Etiqueta>}
                  {probar.data && probar.variables?.id === s.id && (
                    <p className={`text-xs ${probar.data.ok ? 'text-fk-ok-texto' : 'text-fk-error-texto'}`}>
                      Prueba: {probar.data.ok ? `respondió ${probar.data.status}` : probar.data.error}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <BotonIcono
                    etiqueta="Enviar una prueba"
                    icono={Send}
                    cargando={probar.isPending && probar.variables?.id === s.id}
                    onClick={() => probar.mutate(s)}
                  />
                  <BotonIcono etiqueta="Ver envíos" icono={History} onClick={() => setViendo(s)} />
                  <BotonIcono
                    etiqueta={s.activa ? 'Pausar' : 'Reanudar'}
                    icono={s.activa ? Pause : Play}
                    cargando={alternar.isPending && alternar.variables?.id === s.id}
                    onClick={() => alternar.mutate(s)}
                  />
                  <BotonIcono
                    etiqueta="Generar un secreto nuevo"
                    icono={KeyRound}
                    cargando={rotar.isPending && rotar.variables?.id === s.id}
                    onClick={() => {
                      if (window.confirm('¿Generar un secreto nuevo? El anterior deja de valer en el acto.')) rotar.mutate(s);
                    }}
                  />
                  <BotonIcono
                    etiqueta="Eliminar webhook"
                    icono={Trash2}
                    peligro
                    cargando={eliminar.isPending && eliminar.variables?.id === s.id}
                    onClick={() => {
                      if (window.confirm('¿Eliminar este webhook y su historial de envíos?')) eliminar.mutate(s);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <AlertaError error={alternar.error ?? eliminar.error ?? rotar.error ?? probar.error} />
        </div>
      </Tarjeta>
      <NuevoWebhook onCreado={setSecreto} />
      <Modal abierto={secreto !== null} titulo="Secreto de firma" onCerrar={() => setSecreto(null)}>
        {secreto && <SecretoUnaVez secreto={secreto} onListo={() => setSecreto(null)} />}
      </Modal>
      {viendo && <EntregasModal suscripcion={viendo} onCerrar={() => setViendo(null)} />}
    </div>
  );
}

function SecretoUnaVez({ secreto, onListo }: { secreto: string; onListo: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-4 text-sm">
      <Aviso>Copialo ahora: no se vuelve a mostrar. El receptor lo usa para verificar la firma de cada envío.</Aviso>
      <div className="flex gap-2">
        <Entrada readOnly value={secreto} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Boton
          variante="terciario"
          onClick={async () => {
            await navigator.clipboard.writeText(secreto);
            setCopiado(true);
          }}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </Boton>
      </div>
      <div className="flex justify-end">
        <Boton onClick={onListo}>Listo</Boton>
      </div>
    </div>
  );
}

function NuevoWebhook({ onCreado }: { onCreado: (secreto: string) => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [eventos, setEventos] = useState<string[]>(['comprobante.emitido', 'comprobante.rechazado']);

  const crear = useMutation({
    meta: { exito: 'Webhook creado.', error: 'No se pudo crear el webhook.' },
    mutationFn: () => pedir<{ secreto: string }>('/configuracion/webhooks', 'POST', { url: url.trim(), eventos }),
    onSuccess: (r) => {
      setUrl('');
      void queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      onCreado(r.secreto);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Tarjeta titulo="Nuevo webhook">
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="URL que recibe los avisos" ayuda="Tiene que ser https y responder 2xx en menos de 10 segundos.">
          <Entrada type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-sistema.com/webhooks/faktia" required />
        </Campo>
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold text-fk-grafito">Eventos</legend>
          {Object.entries(EVENTOS).map(([id, texto]) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={eventos.includes(id)}
                onChange={() => setEventos((es) => (es.includes(id) ? es.filter((x) => x !== id) : [...es, id]))}
              />
              {texto} <code className="text-xs text-fk-gris-texto">{id}</code>
            </label>
          ))}
        </fieldset>
        <AlertaError error={crear.error} />
        <div className="flex justify-end">
          <Boton type="submit" cargando={crear.isPending} disabled={!eventos.length}>
            Crear webhook
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function EntregasModal({ suscripcion, onCerrar }: { suscripcion: Suscripcion; onCerrar: () => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const clave = ['webhook-entregas', suscripcion.id];
  const { data, error } = useQuery({ queryKey: clave, queryFn: () => pedir<Entrega[]>(`/configuracion/webhooks/${suscripcion.id}/entregas`) });
  const reenviar = useMutation({
    meta: { exito: 'Entrega reenviada.', error: 'No se pudo reenviar la entrega.' },
    mutationFn: (e: Entrega) => pedir(`/configuracion/webhooks/entregas/${e.id}/reenviar`, 'POST'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clave }),
  });

  return (
    <Modal abierto titulo="Últimos envíos" onCerrar={onCerrar}>
      {error ? (
        <AlertaError error={error} />
      ) : !data ? (
        <Cargando />
      ) : data.length === 0 ? (
        <Vacio>Todavía no hubo envíos.</Vacio>
      ) : (
        <ul className="max-h-96 divide-y divide-fk-borde overflow-y-auto text-sm">
          {data.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 py-2">
              <div>
                <p>
                  <Etiqueta tono={ESTADO_ENTREGA[e.estado]}>{e.estado.toLowerCase()}</Etiqueta> <span className="font-mono text-xs">{e.evento}</span>
                </p>
                <p className="text-xs text-fk-gris-texto">
                  {fechaHora(e.createdAt)} · {e.intentos} intento(s){e.ultimoStatus ? ` · HTTP ${e.ultimoStatus}` : ''}
                  {e.estado === 'PENDIENTE' && e.intentos > 0 && ` · próximo ${fechaHora(e.proximoIntento)}`}
                </p>
                {e.ultimoError && <p className="text-xs text-fk-error-texto">{e.ultimoError}</p>}
              </div>
              {e.estado !== 'ENTREGADA' && (
                <BotonIcono
                  etiqueta="Reenviar"
                  icono={RotateCw}
                  cargando={reenviar.isPending && reenviar.variables?.id === e.id}
                  onClick={() => reenviar.mutate(e)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <AlertaError error={reenviar.error} />
      </div>
    </Modal>
  );
}
