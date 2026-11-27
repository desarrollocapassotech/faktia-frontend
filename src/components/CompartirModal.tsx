import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Mail, MessageCircle } from 'lucide-react';
import { AlertaError, Boton, Campo, Entrada, Modal } from '@/components/ui';
import { toast } from '@/lib/toasts';
import { useApi } from '@/lib/useApi';

const PDF_DE_PRUEBA = () => new File([''], 'prueba.pdf', { type: 'application/pdf' });

/** El navegador puede compartir archivos (celulares, Chrome/Edge de escritorio): abre WhatsApp con el PDF. */
const puedeCompartirArchivos = () => typeof navigator !== 'undefined' && Boolean(navigator.canShare?.({ files: [PDF_DE_PRUEBA()] }));

function guardarArchivo(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Compartir un documento en PDF por WhatsApp o por email.
 * - WhatsApp: con el "compartir" del sistema, el PDF va adjunto. Si el navegador no puede compartir
 *   archivos, se descarga el PDF y se abre WhatsApp con el mensaje, para adjuntarlo a mano.
 * - Email: lo manda el backend con el PDF adjunto (`enviarEmail`).
 * El PDF se trae al abrir el modal: el "compartir" del sistema exige que se llame enseguida del click.
 */
export function CompartirModal({
  abierto,
  onCerrar,
  titulo,
  rutaPdf,
  nombreArchivo,
  mensaje,
  emailSugerido,
  enviarEmail,
  onCompartido,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** "Compartir presupuesto P-0000002". */
  titulo: string;
  rutaPdf: string;
  nombreArchivo: string;
  /** Texto generado por el sistema que acompaña al PDF por WhatsApp (no se edita). El del email lo arma el backend. */
  mensaje: string;
  emailSugerido?: string | null;
  enviarEmail: (datos: { para: string[] }) => Promise<unknown>;
  /**
   * Después de compartir: por email, cuando el backend confirma el envío; por WhatsApp, cuando se
   * elige a quién mandarlo (o se abre WhatsApp). Sirve para marcar el documento como enviado.
   */
  onCompartido?: (medio: 'email' | 'whatsapp') => void;
}) {
  const { traerArchivo } = useApi();
  const [para, setPara] = useState(emailSugerido ?? '');
  const texto = mensaje;
  const compartirSistema = puedeCompartirArchivos();

  const archivo = useQuery({ queryKey: ['archivo-compartir', rutaPdf], queryFn: () => traerArchivo(rutaPdf, nombreArchivo), enabled: abierto, staleTime: 0, gcTime: 0 });

  const email = useMutation({
    meta: { exito: 'Enviado por email.', error: 'No se pudo enviar el email.' },
    mutationFn: () =>
      enviarEmail({
        para: para
          .split(/[,;\s]+/)
          .map((x) => x.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      onCompartido?.('email');
      onCerrar();
    },
  });

  async function porWhatsapp() {
    const pdf = archivo.data;
    if (!pdf) return;
    if (compartirSistema) {
      try {
        await navigator.share({ files: [pdf], title: titulo, text: texto });
        onCompartido?.('whatsapp');
        onCerrar();
      } catch (err) {
        // Cerrar el panel del sistema sin elegir nada no es un error.
        if ((err as Error).name !== 'AbortError') toast.error('No se pudo compartir.', (err as Error).message);
      }
      return;
    }
    // Sin "compartir" del sistema: se abre WhatsApp con el mensaje y se descarga el PDF para adjuntarlo.
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    guardarArchivo(pdf);
    toast.exito('PDF descargado.', 'Adjuntalo en el chat de WhatsApp que se abrió.');
    onCompartido?.('whatsapp');
    onCerrar();
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    email.mutate();
  }

  return (
    <Modal abierto={abierto} titulo={titulo} onCerrar={onCerrar} ancho="grande">
      <form onSubmit={enviar} className="space-y-5">
        {/* WhatsApp y Email lado a lado en pantallas medianas; los botones quedan alineados abajo. */}
        <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-fk border border-fk-borde p-4">
          <h3 className="fk-etiqueta flex items-center gap-2">
            <MessageCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            WhatsApp
          </h3>
          <p className="text-sm text-fk-gris-texto">
            {compartirSistema ? 'Se abre el menú para compartir del sistema: elegí WhatsApp y el contacto. El PDF va adjunto.' : 'Se abre WhatsApp con el mensaje y se descarga el PDF para que lo adjuntes en el chat.'}
          </p>
          <AlertaError error={archivo.error} />
          <Boton variante="secundario" className="mt-auto self-start" onClick={() => void porWhatsapp()} cargando={archivo.isLoading} disabled={!archivo.data}>
            <MessageCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Compartir por WhatsApp
          </Boton>
        </section>

        <section className="flex flex-col gap-3 rounded-fk border border-fk-borde p-4">
          <h3 className="fk-etiqueta flex items-center gap-2">
            <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Email
          </h3>
          <p className="text-sm text-fk-gris-texto">Le llega un correo con el resumen del presupuesto, el PDF adjunto y tus datos de contacto. Si responde, te llega a vos.</p>
          <Campo etiqueta="Para" ayuda="Podés poner varios, separados por coma.">
            <Entrada type="text" inputMode="email" value={para} onChange={(e) => setPara(e.target.value)} placeholder="cliente@ejemplo.com" required maxLength={1000} />
          </Campo>
          <AlertaError error={email.error} />
          <Boton type="submit" variante="secundario" className="mt-auto self-start" cargando={email.isPending}>
            <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Enviar por email
          </Boton>
        </section>
        </div>
      </form>
    </Modal>
  );
}
