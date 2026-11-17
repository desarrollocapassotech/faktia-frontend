import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CircleCheck } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Selector, Tarjeta } from '@/components/ui';
import { CONDICIONES_IVA, cuit, soloFecha } from '@/lib/formato';
import type { CondicionIva, Emisor } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

/** Mismo aspecto que un campo deshabilitado, pero readOnly: se puede seleccionar y copiar. */
const claseBloqueado = 'cursor-default bg-fk-blanco-roto text-fk-gris-texto';

interface DatosPadron {
  cuit: string;
  razonSocial: string;
  domicilio: string | null;
  condicionIva: CondicionIva | null;
  /** Alta del impuesto más antiguo: ARCA no informa la fecha exacta de inicio de actividades. */
  inicioActividadesSugerido: string | null;
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
  // Con el certificado de plataforma del servidor: funciona aunque la empresa esté en pruebas.
  const consultaPadron = emisor.padronDisponible === true;
  const padron = useMutation({
    mutationFn: (cuitBuscado: string) => pedir<DatosPadron>(`/configuracion/emisor/padron/${cuitBuscado}`),
    onSuccess: (d, cuitBuscado) => {
      // Si mientras tanto cambió el CUIT, esta respuesta ya no corresponde.
      if (cuitBuscado !== ultimoCuitBuscado.current) return;
      if (!cuitEditable) {
        // CUIT ya guardado: solo se completa lo que falta, sin tocar lo que cargó la empresa.
        setForm((f) => ({ ...f, inicioActividades: f.inicioActividades || d.inicioActividadesSugerido || '' }));
        return;
      }
      setForm((f) => ({
        ...f,
        razonSocial: d.razonSocial || f.razonSocial,
        domicilioFiscal: d.domicilio ?? f.domicilioFiscal,
        condicionIva: d.condicionIva ?? f.condicionIva,
        // Sugerencia: queda editable (no se pisa si ya había una fecha cargada).
        inicioActividades: f.inicioActividades || d.inicioActividadesSugerido || '',
      }));
      setAvisoPadron(d.condicionIva ? null : 'ARCA no informó la condición frente al IVA: elegila a mano.');
    },
  });
  const digitosCuit = form.cuit.replace(/\D/g, '');
  // Lo que vino de ARCA no se edita a mano. Si cambia el CUIT, padron se resetea y se libera.
  // Con el CUIT ya guardado no se bloquea nada: solo se consultó para sugerir el inicio de actividades.
  const deArca = padron.isSuccess ? padron.data : null;
  const bloqueado = {
    razonSocial: cuitEditable && Boolean(deArca?.razonSocial),
    condicionIva: cuitEditable && Boolean(deArca?.condicionIva),
    domicilioFiscal: cuitEditable && Boolean(deArca?.domicilio),
  };

  // CUIT guardado sin inicio de actividades (ej. cargado antes de que se sugiriera): se pide a ARCA una vez.
  useEffect(() => {
    if (cuitEditable || !consultaPadron || !emisor.cuit || emisor.inicioActividades || ultimoCuitBuscado.current) return;
    ultimoCuitBuscado.current = emisor.cuit;
    padron.mutate(emisor.cuit);
    // Solo al montar: el formulario se vuelve a montar (key) cuando cambian los datos guardados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const AYUDA_ARCA = 'Completado con lo registrado en ARCA.';

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
        {/* Con el CUIT ya guardado la consulta es solo una sugerencia: si falla, no se avisa. */}
        {cuitEditable && <AlertaError error={padron.error} />}
        {avisoPadron && <Aviso>{avisoPadron}</Aviso>}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cuitEditable ? (
            <Campo
              etiqueta="CUIT"
              ayuda={
                padron.isPending
                  ? 'Buscando en el padrón de ARCA…'
                  : padron.isSuccess
                    ? (
                        <span className="inline-flex items-center gap-1 font-medium text-fk-ok-texto">
                          <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          Validado en ARCA
                        </span>
                      )
                    : consultaPadron
                      ? 'Lo validamos en ARCA y completamos el resto. Después solo se cambia desde soporte.'
                      : 'Revisalo bien: después solo se cambia desde soporte.'
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
          <Campo etiqueta="Razón social" ayuda={bloqueado.razonSocial ? AYUDA_ARCA : undefined}>
            <Entrada
              value={form.razonSocial}
              onChange={(e) => cambiar('razonSocial', e.target.value)}
              required
              maxLength={200}
              readOnly={bloqueado.razonSocial}
              aria-readonly={bloqueado.razonSocial}
              className={bloqueado.razonSocial ? claseBloqueado : ''}
            />
          </Campo>
          <Campo etiqueta="Nombre de fantasía">
            <Entrada value={form.nombreFantasia} onChange={(e) => cambiar('nombreFantasia', e.target.value)} required maxLength={120} />
          </Campo>
          <Campo etiqueta="Condición frente al IVA" ayuda={bloqueado.condicionIva ? AYUDA_ARCA : undefined}>
            <Selector
              value={form.condicionIva}
              onChange={(e) => cambiar('condicionIva', e.target.value as CondicionIva)}
              required
              // Un select no tiene readOnly: se deshabilita (el valor se manda igual desde el estado).
              disabled={bloqueado.condicionIva}
            >
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
          <Campo etiqueta="Domicilio fiscal" ayuda={bloqueado.domicilioFiscal ? AYUDA_ARCA : undefined}>
            <Entrada
              value={form.domicilioFiscal}
              onChange={(e) => cambiar('domicilioFiscal', e.target.value)}
              required
              maxLength={300}
              readOnly={bloqueado.domicilioFiscal}
              aria-readonly={bloqueado.domicilioFiscal}
              className={bloqueado.domicilioFiscal ? claseBloqueado : ''}
            />
          </Campo>
          <Campo etiqueta="Ingresos brutos" ayuda="Opcional. Se imprime en el PDF.">
            <Entrada value={form.ingresosBrutos} onChange={(e) => cambiar('ingresosBrutos', e.target.value)} maxLength={40} />
          </Campo>
          <Campo
            etiqueta="Inicio de actividades"
            ayuda={
              deArca?.inicioActividadesSugerido && form.inicioActividades === deArca.inicioActividadesSugerido
                ? 'Sugerido según ARCA (mes de alta del primer impuesto). Revisalo: se imprime en el PDF.'
                : 'Obligatorio para emitir. Se imprime en el PDF.'
            }
          >
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
