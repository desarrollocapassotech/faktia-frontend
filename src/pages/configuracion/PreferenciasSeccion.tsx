import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/auth-context';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, EntradaNumero, Etiqueta, Tarjeta } from '@/components/ui';
import { dinero, fecha } from '@/lib/formato';
import type { HistorialAvisos, PreferenciasEmpresa, VistaPreviaAviso } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { toast } from '@/lib/toasts';

const NOMBRE_MODULO: Record<string, string> = {
  comprobantes: 'Facturación electrónica',
  recibos: 'Recibos de cobro',
  'recibos-pago': 'Recibos de pago',
  'cuenta-corriente': 'Cuenta corriente',
  proyectos: 'Proyectos',
  presupuestos: 'Presupuestos',
  materiales: 'Materiales y proveedores',
  importaciones: 'Importaciones',
  integraciones: 'Integraciones y API',
  webhooks: 'Webhooks',
};

/** Cómo se llaman los proyectos en la empresa y qué módulos tiene habilitados (eso lo cambia Faktia). */
export function PreferenciasSeccion() {
  const { pedir } = useApi();
  const { data, error } = useQuery({ queryKey: ['preferencias'], queryFn: () => pedir<PreferenciasEmpresa>('/configuracion/preferencias') });
  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  return (
    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
      <FormularioEtiquetas key={`${data.etiquetaProyecto}|${data.etiquetaProyectoPlural}`} preferencias={data} />
      {data.modulos.includes('presupuestos') && <ValidezPresupuestos key={data.diasValidezPresupuesto} dias={data.diasValidezPresupuesto} />}
      {data.modulos.includes('cuenta-corriente') && <Avisos key={`${data.avisosEmail}|${data.diasAvisoVencimiento}`} preferencias={data} />}
      <Tarjeta titulo="Módulos habilitados">
        <p className="mb-3 text-sm text-fk-gris-texto">Para sumar o quitar un módulo, escribinos.</p>
        <div className="flex flex-wrap gap-2">
          {data.modulos.map((m) => (
            <Etiqueta key={m} tono="ok">
              {NOMBRE_MODULO[m] ?? m}
            </Etiqueta>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

function FormularioEtiquetas({ preferencias }: { preferencias: PreferenciasEmpresa }) {
  const { pedir } = useApi();
  const { refrescarPerfil } = useAuth();
  const [singular, setSingular] = useState(preferencias.etiquetaProyecto);
  const [plural, setPlural] = useState(preferencias.etiquetaProyectoPlural);
  const [guardado, setGuardado] = useState(false);
  const guardar = useMutation({
    meta: { exito: 'Preferencias guardadas.', error: 'No se pudieron guardar las preferencias.' },
    mutationFn: () =>
      pedir<PreferenciasEmpresa>('/configuracion/preferencias', 'PATCH', { etiquetaProyecto: singular.trim(), etiquetaProyectoPlural: plural.trim() }),
    onSuccess: async () => {
      setGuardado(true);
      // El menú toma la etiqueta del perfil de la sesión.
      await refrescarPerfil();
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Tarjeta titulo="Nombre de los proyectos">
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-fk-gris-texto">Cómo aparecen en el menú, las pantallas y los documentos. Por ejemplo: Obra y Obras.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Singular">
            <Entrada
              value={singular}
              onChange={(e) => {
                setSingular(e.target.value);
                setGuardado(false);
              }}
              maxLength={40}
              required
            />
          </Campo>
          <Campo etiqueta="Plural">
            <Entrada
              value={plural}
              onChange={(e) => {
                setPlural(e.target.value);
                setGuardado(false);
              }}
              maxLength={40}
              required
            />
          </Campo>
        </div>
        <AlertaError error={guardar.error} />
        {guardado && <Aviso tono="verde">Guardado.</Aviso>}
        <div className="flex justify-end">
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/**
 * Resumen diario por email (a las 8) a todos los usuarios con lo vencido y lo que vence en los
 * próximos días. Lo que falta certificar de una obra no vence: no entra.
 */
function Avisos({ preferencias }: { preferencias: PreferenciasEmpresa }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [activos, setActivos] = useState(preferencias.avisosEmail);
  const [dias, setDias] = useState(String(preferencias.diasAvisoVencimiento));
  const [guardado, setGuardado] = useState(false);
  const vista = useQuery({ queryKey: ['avisos', 'vista-previa'], queryFn: () => pedir<VistaPreviaAviso>('/avisos/vista-previa') });
  const historial = useQuery({ queryKey: ['avisos', 'historial'], queryFn: () => pedir<HistorialAvisos>('/avisos/historial') });
  const guardar = useMutation({
    meta: { exito: 'Avisos guardados.', error: 'No se pudieron guardar los avisos.' },
    mutationFn: () => pedir<PreferenciasEmpresa>('/configuracion/preferencias', 'PATCH', { avisosEmail: activos, diasAvisoVencimiento: Number(dias) || 0 }),
    onSuccess: (p) => {
      queryClient.setQueryData(['preferencias'], p);
      void queryClient.invalidateQueries({ queryKey: ['avisos'] });
      setGuardado(true);
    },
  });
  const probar = useMutation({ meta: { error: 'No se pudo enviar el correo de prueba.' }, mutationFn: () => pedir<{ enviado: boolean; destinatarios?: string[] }>('/avisos/probar', 'POST'),
    onSuccess: (r) => (r.enviado ? toast.exito('Correo de prueba enviado.', r.destinatarios?.join(', ')) : toast.error('No se envió el correo de prueba.')),
  });
  const items = [...(vista.data?.vencidos ?? []), ...(vista.data?.proximos ?? [])];

  return (
    <Tarjeta titulo="Avisos de vencimientos">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={activos}
            onChange={(e) => {
              setActivos(e.target.checked);
              setGuardado(false);
            }}
          />
          <span>
            Mandar un resumen por email cada mañana
            <span className="block text-xs text-fk-gris-texto">Llega a todos los usuarios de la empresa, solo los días que hay algo vencido o por vencer.</span>
          </span>
        </label>
        <Campo etiqueta="Avisar con anticipación (días)" className="max-w-xs">
          <EntradaNumero
            value={dias}
            onValueChange={(v) => {
              setDias(v);
              setGuardado(false);
            }}
            maxDecimales={0}
            sinNegativos
          />
        </Campo>
        <AlertaError error={guardar.error} />
        {guardado && <Aviso tono="verde">Guardado.</Aviso>}
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="terciario" cargando={probar.isPending} onClick={() => probar.mutate()}>
            Mandarme una prueba
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
        <AlertaError error={probar.error} />
        {probar.data?.enviado && (
          <Aviso tono={historial.data?.transporte === 'log' ? 'ambar' : 'verde'}>
            {historial.data?.transporte === 'log'
              ? 'El servidor todavía no tiene SMTP configurado: el email quedó registrado pero no salió.'
              : `Enviado a ${probar.data.destinatarios?.join(', ')}.`}
          </Aviso>
        )}
      </form>
      <div className="mt-6 space-y-2 border-t border-fk-borde pt-4">
        <h3 className="fk-etiqueta">Lo que diría el aviso de hoy</h3>
        {vista.isLoading ? (
          <Cargando />
        ) : items.length === 0 ? (
          <p className="text-sm text-fk-gris-texto">Nada vencido ni por vencer: hoy no se manda.</p>
        ) : (
          <ul className="divide-y divide-fk-borde text-sm">
            {items.map((i, n) => (
              <li key={n} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{i.cliente}</span>
                  <span className="block text-xs text-fk-gris-texto">
                    {i.concepto}
                    {i.proyecto ? ` · ${i.proyecto}` : ''} · vence {fecha(i.fechaVencimiento)}
                  </span>
                </span>
                <span className="fk-num whitespace-nowrap">{dinero(i.pendiente, i.moneda)}</span>
              </li>
            ))}
          </ul>
        )}
        {historial.data && historial.data.envios.length > 0 && (
          <p className="text-xs text-fk-gris-texto">Último envío: {fecha(historial.data.envios[0].fecha)} a {historial.data.envios[0].destinatarios.length} usuario(s).</p>
        )}
      </div>
    </Tarjeta>
  );
}

/** Validez por defecto de un presupuesto nuevo. */
function ValidezPresupuestos({ dias: inicial }: { dias: number }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [dias, setDias] = useState(String(inicial));
  const guardar = useMutation({
    meta: { exito: 'Preferencias guardadas.', error: 'No se pudieron guardar las preferencias.' },
    mutationFn: () => pedir<PreferenciasEmpresa>('/configuracion/preferencias', 'PATCH', { diasValidezPresupuesto: Number(dias) || 15 }),
    onSuccess: (p) => queryClient.setQueryData(['preferencias'], p),
  });
  return (
    <Tarjeta titulo="Presupuestos">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <Campo etiqueta="Validez por defecto (días)" ayuda="Al llegar a la fecha sin aceptarse ni rechazarse, pasa solo a vencido.">
          <EntradaNumero value={dias} onValueChange={setDias} maxDecimales={0} sinNegativos />
        </Campo>
        <Boton type="submit" variante="terciario" cargando={guardar.isPending}>
          Guardar
        </Boton>
      </form>
      <AlertaError error={guardar.error} />
      {guardar.isSuccess && <p className="mt-2 text-sm text-fk-pino">Guardado.</p>}
    </Tarjeta>
  );
}
