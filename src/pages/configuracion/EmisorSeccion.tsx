import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/auth-context';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Selector, Tarjeta } from '@/components/ui';
import { CONDICIONES_IVA, cuit, soloFecha } from '@/lib/formato';
import type { CondicionIva, Emisor } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

interface DatosPadron {
  cuit: string;
  razonSocial: string;
  domicilio: string | null;
  condicionIva: CondicionIva | null;
}

export function EmisorSeccion() {
  const { pedir } = useApi();
  const { data, error } = useQuery({ queryKey: ['emisor'], queryFn: () => pedir<Emisor>('/configuracion/emisor') });
  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  // key: al recargar los datos del servidor, el formulario arranca de nuevo con los valores guardados.
  return <FormularioEmisor key={JSON.stringify(data)} emisor={data} />;
}

function FormularioEmisor({ emisor }: { emisor: Emisor }) {
  const { pedir } = useApi();
  const { refrescarPerfil } = useAuth();
  const queryClient = useQueryClient();
  // Empresa recién registrada: el CUIT se carga acá una sola vez; después solo se cambia desde soporte.
  const cuitEditable = !emisor.cuit;
  const [form, setForm] = useState({
    nombreFantasia: emisor.nombreFantasia,
    cuit: emisor.cuit ?? '',
    razonSocial: emisor.razonSocial ?? '',
    condicionIva: emisor.condicionIva ?? ('' as CondicionIva | ''),
    domicilioFiscal: emisor.domicilioFiscal ?? '',
    ingresosBrutos: emisor.ingresosBrutos ?? '',
    inicioActividades: soloFecha(emisor.inicioActividades),
  });
  const [guardado, setGuardado] = useState(false);
  const [avisoPadron, setAvisoPadron] = useState<string | null>(null);
  const ultimoCuitBuscado = useRef<string | null>(null);

  // Al cargar el CUIT se busca en el padrón de ARCA y se completan razón social, condición IVA y domicilio.
  // Solo en producción: el padrón de homologación es ficticio (faltan personas y los datos están alterados).
  const consultaPadron = emisor.ambienteArca === 'PRODUCCION';
  const padron = useMutation({
    mutationFn: (cuitBuscado: string) => pedir<DatosPadron>(`/configuracion/emisor/padron/${cuitBuscado}`),
    onSuccess: (d, cuitBuscado) => {
      // Si mientras tanto cambió el CUIT, esta respuesta ya no corresponde.
      if (cuitBuscado !== ultimoCuitBuscado.current) return;
      setForm((f) => ({
        ...f,
        razonSocial: d.razonSocial || f.razonSocial,
        domicilioFiscal: d.domicilio ?? f.domicilioFiscal,
        condicionIva: d.condicionIva ?? f.condicionIva,
      }));
      setAvisoPadron(d.condicionIva ? null : 'ARCA no informó la condición frente al IVA: elegila a mano.');
    },
  });
  const digitosCuit = form.cuit.replace(/\D/g, '');

  function cambiarCuit(valor: string) {
    cambiar('cuit', valor);
    setAvisoPadron(null);
    if (!consultaPadron) return;
    const digitos = valor.replace(/\D/g, '');
    if (digitos === ultimoCuitBuscado.current && !padron.isError) return;
    if (digitos.length === 11) {
      ultimoCuitBuscado.current = digitos;
      padron.mutate(digitos);
    } else {
      ultimoCuitBuscado.current = null;
      padron.reset();
    }
  }

  const guardar = useMutation({
    mutationFn: () =>
      pedir<Emisor>('/configuracion/emisor', 'PATCH', {
        ...(cuitEditable ? { cuit: form.cuit.trim() } : {}),
        nombreFantasia: form.nombreFantasia.trim(),
        razonSocial: form.razonSocial.trim(),
        condicionIva: form.condicionIva || undefined,
        domicilioFiscal: form.domicilioFiscal.trim(),
        ingresosBrutos: form.ingresosBrutos.trim() || null,
        inicioActividades: form.inicioActividades || null,
      }),
    onSuccess: (emisor) => {
      queryClient.setQueryData(['emisor'], emisor);
      void queryClient.invalidateQueries({ queryKey: ['arca'] });
      // El aviso de "completá tus datos" sale del perfil de la sesión.
      void refrescarPerfil().catch(() => undefined);
      setGuardado(true);
    },
  });

  function cambiar<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setGuardado(false);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Tarjeta titulo="Datos del emisor">
      <form onSubmit={enviar} className="space-y-5">
        {!emisor.datosFiscalesCompletos && (
          <Aviso tono="azul">Completá los datos fiscales de tu empresa para empezar a facturar. Salen impresos en cada comprobante.</Aviso>
        )}
        <AlertaError error={padron.error} />
        {avisoPadron && <Aviso>{avisoPadron}</Aviso>}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cuitEditable ? (
            <Campo
              etiqueta="CUIT"
              ayuda={
                padron.isPending
                  ? 'Buscando en el padrón de ARCA…'
                  : padron.isSuccess
                    ? `✓ Validado en ARCA: ${padron.data.razonSocial || 'CUIT registrado'}`
                    : consultaPadron
                      ? 'Lo validamos en ARCA y completamos el resto. Después solo se cambia desde soporte.'
                      : 'Revisalo bien: después solo se cambia desde soporte. Se valida en ARCA al pasar a producción.'
              }
            >
              <div className="flex gap-2">
                <Entrada
                  value={form.cuit}
                  onChange={(e) => cambiarCuit(e.target.value)}
                  required
                  inputMode="numeric"
                  placeholder="30-12345678-9"
                  pattern="\d{2}-?\d{8}-?\d"
                  title="11 dígitos, con o sin guiones."
                  maxLength={13}
                  className="tabular-nums"
                  aria-invalid={padron.isError}
                />
                {padron.isError && (
                  <Boton variante="terciario" onClick={() => padron.mutate(digitosCuit)} className="shrink-0">
                    Reintentar
                  </Boton>
                )}
              </div>
            </Campo>
          ) : (
            <Campo etiqueta="CUIT" ayuda="Se cambia desde soporte: define con qué CUIT se emite en ARCA.">
              <Entrada value={cuit(emisor.cuit ?? '')} disabled className="tabular-nums" />
            </Campo>
          )}
          <Campo etiqueta="Razón social">
            <Entrada value={form.razonSocial} onChange={(e) => cambiar('razonSocial', e.target.value)} required maxLength={200} />
          </Campo>
          <Campo etiqueta="Nombre de fantasía">
            <Entrada value={form.nombreFantasia} onChange={(e) => cambiar('nombreFantasia', e.target.value)} required maxLength={120} />
          </Campo>
          <Campo etiqueta="Condición frente al IVA">
            <Selector value={form.condicionIva} onChange={(e) => cambiar('condicionIva', e.target.value as CondicionIva)} required>
              {!form.condicionIva && (
                <option value="" disabled>
                  Elegí una opción
                </option>
              )}
              {Object.entries(CONDICIONES_IVA).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Domicilio fiscal">
            <Entrada value={form.domicilioFiscal} onChange={(e) => cambiar('domicilioFiscal', e.target.value)} required maxLength={300} />
          </Campo>
          <Campo etiqueta="Ingresos brutos" ayuda="Opcional. Se imprime en el PDF.">
            <Entrada value={form.ingresosBrutos} onChange={(e) => cambiar('ingresosBrutos', e.target.value)} maxLength={40} />
          </Campo>
          <Campo etiqueta="Inicio de actividades" ayuda="Obligatorio para emitir. Se imprime en el PDF.">
            <Entrada type="date" value={form.inicioActividades} onChange={(e) => cambiar('inicioActividades', e.target.value)} />
          </Campo>
        </div>
        <AlertaError error={guardar.error} />
        {guardado && <Aviso tono="verde">Datos guardados.</Aviso>}
        <div className="flex justify-end">
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
