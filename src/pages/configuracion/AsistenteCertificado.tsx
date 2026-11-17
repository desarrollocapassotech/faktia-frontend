import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ExternalLink, FileKey2, KeyRound, Rocket, ShieldCheck, Store, Upload } from 'lucide-react';
import { AlertaError, Aviso, Ayuda, Boton, Campo, Entrada, Tarjeta } from '@/components/ui';
import { descargarTexto, generarPedidoCertificado } from '@/lib/csr';
import { cuit as formatearCuit } from '@/lib/formato';
import { guardar, leer } from '@/lib/storage';
import type { Certificado, Emisor, PuntoVenta } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

const URL_ARCA = 'https://auth.afip.gob.ar/contribuyente_/login.xhtml';

const PASOS = [
  { id: 'generar', titulo: 'Crear la clave', icono: KeyRound },
  { id: 'arca-cert', titulo: 'Pedir el certificado', icono: FileKey2 },
  { id: 'arca-relacion', titulo: 'Autorizarlo', icono: ShieldCheck },
  { id: 'arca-pv', titulo: 'Punto de venta', icono: Store },
  { id: 'cargar', titulo: 'Subirlo', icono: Upload },
  { id: 'produccion', titulo: 'Activar', icono: Rocket },
] as const;
type IdPaso = (typeof PASOS)[number]['id'];

/** Progreso guardado en el navegador, por empresa: se puede dejar a mitad y seguir otro día. */
interface Progreso {
  actual: number;
  hechos: IdPaso[];
  alias: string;
}

const claveProgreso = (tenantId: string) => `faktia.asistenteCertificado.${tenantId}`;

function leerProgreso(tenantId: string): Progreso {
  try {
    const p = JSON.parse(leer(claveProgreso(tenantId)) ?? 'null') as Partial<Progreso> | null;
    return {
      actual: Math.min(Math.max(Number(p?.actual) || 0, 0), PASOS.length - 1),
      hechos: Array.isArray(p?.hechos) ? p.hechos.filter((h): h is IdPaso => PASOS.some((x) => x.id === h)) : [],
      alias: typeof p?.alias === 'string' && p.alias ? p.alias : 'faktia',
    };
  } catch {
    return { actual: 0, hechos: [], alias: 'faktia' };
  }
}

/**
 * Paso a paso para obtener el certificado de producción de ARCA (Web Services de factura
 * electrónica). Un paso por vez, poco texto y el detalle detrás de íconos de ayuda.
 * La clave y el pedido (CSR) se generan en el navegador.
 */
export function AsistenteCertificado({ emisor }: { emisor: Emisor }) {
  // El certificado se pide a nombre de la empresa: sin CUIT y razón social no hay con qué armarlo.
  if (!emisor.cuit || !emisor.razonSocial) {
    return (
      <Tarjeta titulo="Certificado de ARCA">
        <Aviso tono="azul">Primero completá los datos de tu empresa.</Aviso>
      </Tarjeta>
    );
  }
  return <Asistente emisor={{ ...emisor, cuit: emisor.cuit, razonSocial: emisor.razonSocial }} />;
}

function Asistente({ emisor }: { emisor: Emisor & { cuit: string; razonSocial: string } }) {
  const { pedir } = useApi();
  const certificados = useQuery({ queryKey: ['certificados'], queryFn: () => pedir<Certificado[]>('/configuracion/certificados') });
  const puntos = useQuery({ queryKey: ['puntos-venta'], queryFn: () => pedir<PuntoVenta[]>('/configuracion/puntos-venta') });

  const [progreso, setProgreso] = useState<Progreso>(() => leerProgreso(emisor.id));
  // La clave generada en esta visita, para no tener que buscar el archivo en el paso de subirlo.
  const [claveGenerada, setClaveGenerada] = useState<string | null>(null);

  useEffect(() => {
    guardar(claveProgreso(emisor.id), JSON.stringify(progreso));
  }, [emisor.id, progreso]);

  // Lo que Faktia puede comprobar sola cuenta como hecho aunque no se haya marcado.
  const pvProduccion = puntos.data?.find((p) => p.ambiente === 'PRODUCCION' && p.activo) ?? null;
  const certProduccion = certificados.data?.some((c) => c.ambiente === 'PRODUCCION') ?? false;
  const comprobados: Partial<Record<IdPaso, boolean>> = {
    'arca-pv': Boolean(pvProduccion),
    cargar: certProduccion,
    produccion: emisor.ambienteArca === 'PRODUCCION',
  };
  const hecho = (id: IdPaso) => progreso.hechos.includes(id) || Boolean(comprobados[id]);

  const actual = progreso.actual;
  const paso = PASOS[actual];
  const alias = progreso.alias;

  function irA(i: number) {
    setProgreso((p) => ({ ...p, actual: Math.min(Math.max(i, 0), PASOS.length - 1) }));
  }
  function completarYSeguir(id: IdPaso = paso.id) {
    setProgreso((p) => ({
      ...p,
      hechos: [...new Set([...p.hechos, id])],
      actual: Math.min(PASOS.findIndex((x) => x.id === id) + 1, PASOS.length - 1),
    }));
  }
  // Se puede volver a cualquier paso ya hecho, o ir hasta el primero que falta.
  const primeroPendiente = PASOS.findIndex((x) => !hecho(x.id));
  const alcanzable = (i: number) => hecho(PASOS[i].id) || i <= actual || i <= (primeroPendiente === -1 ? PASOS.length - 1 : primeroPendiente);

  return (
    <Tarjeta
      titulo={
        <span className="inline-flex items-center gap-1.5">
          Certificado de ARCA
          <Ayuda etiqueta="Para qué sirve">
            Autoriza a Faktia a emitir facturas en tu nombre. Se hace una sola vez con tu clave fiscal (nivel 3), tarda unos 15 minutos y
            dura 2 años. Podés dejarlo a mitad: tu avance queda guardado.
          </Ayuda>
        </span>
      }
    >
      <div className="space-y-6">
        {/* Progreso */}
        <ol className="grid grid-cols-6 gap-1.5" aria-label="Pasos">
          {PASOS.map((p, i) => {
            const esActual = i === actual;
            const listo = hecho(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => alcanzable(i) && irA(i)}
                  disabled={!alcanzable(i)}
                  aria-current={esActual ? 'step' : undefined}
                  aria-label={`Paso ${i + 1}: ${p.titulo}${listo ? ' (listo)' : ''}`}
                  title={p.titulo}
                  className="flex w-full flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                      listo ? 'bg-fk-pino text-fk-blanco' : esActual ? 'bg-fk-fiordo text-fk-blanco' : 'bg-fk-niebla text-fk-gris-texto'
                    }`}
                  >
                    {listo ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : <p.icono className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
                  </span>
                  <span className={`hidden text-center text-xs leading-tight md:block ${esActual ? 'font-semibold text-fk-grafito' : 'text-fk-gris-texto'}`}>
                    {p.titulo}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Paso actual */}
        <section className="space-y-5 rounded-fk bg-fk-blanco-roto/60 p-5 sm:p-6" aria-live="polite">
          <h3 className="fk-subtitulo flex flex-wrap items-center gap-2">
            <span className="text-fk-gris-texto tabular-nums">{actual + 1}.</span>
            {TITULOS[paso.id]}
            {hecho(paso.id) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-fk-ok-texto">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                Hecho
              </span>
            )}
          </h3>

          {paso.id === 'generar' && (
            <PasoGenerar
              emisor={emisor}
              alias={alias}
              onAlias={(a) => setProgreso((p) => ({ ...p, alias: a }))}
              onGenerada={(clave) => {
                setClaveGenerada(clave);
                setProgreso((p) => ({ ...p, hechos: [...new Set([...p.hechos, 'generar' as const])] }));
              }}
              generadaAhora={claveGenerada !== null}
            />
          )}
          {paso.id === 'arca-cert' && <PasoPedirCertificado cuit={emisor.cuit} alias={alias} />}
          {paso.id === 'arca-relacion' && <PasoAutorizar cuit={emisor.cuit} alias={alias} />}
          {paso.id === 'arca-pv' && (
            <PasoPuntoVenta
              cuit={emisor.cuit}
              monotributo={emisor.condicionIva === 'MONOTRIBUTO'}
              existente={pvProduccion}
              onCreado={() => completarYSeguir('arca-pv')}
            />
          )}
          {paso.id === 'cargar' && (
            <SubirCertificado alias={alias} claveGenerada={claveGenerada} yaCargado={certProduccion} textoBoton="Subir y seguir" onCargado={() => completarYSeguir('cargar')} />
          )}
          {paso.id === 'produccion' && <PasoProduccion enProduccion={emisor.ambienteArca === 'PRODUCCION'} />}
        </section>

        {/* Navegación */}
        <div className="flex items-center justify-between gap-3">
          <Boton variante="fantasma" onClick={() => irA(actual - 1)} disabled={actual === 0}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Anterior
          </Boton>
          {actual < PASOS.length - 1 && (
            <Boton onClick={() => completarYSeguir()} disabled={!puedeSeguir(paso.id, hecho)}>
              {hecho(paso.id) ? 'Siguiente' : TEXTO_SEGUIR[paso.id]}
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Boton>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

const TITULOS: Record<IdPaso, string> = {
  generar: 'Creá tu clave',
  'arca-cert': 'Pedí el certificado en ARCA',
  'arca-relacion': 'Autorizalo para facturar',
  'arca-pv': 'Creá un punto de venta',
  cargar: 'Subí el certificado',
  produccion: 'Activá producción',
};

const TEXTO_SEGUIR: Record<IdPaso, string> = {
  generar: 'Siguiente',
  'arca-cert': 'Ya tengo el .crt',
  'arca-relacion': 'Ya lo autoricé',
  'arca-pv': 'Siguiente',
  cargar: 'Siguiente',
  produccion: 'Siguiente',
};

/** Los pasos que se hacen dentro de Faktia solo avanzan cuando están hechos de verdad. */
function puedeSeguir(id: IdPaso, hecho: (id: IdPaso) => boolean): boolean {
  if (id === 'generar' || id === 'arca-pv' || id === 'cargar') return hecho(id);
  return true;
}

// ── Piezas ───────────────────────────────────────────────────────────────

/** Lista de acciones cortas, numeradas. */
function Acciones({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-5 text-sm marker:font-semibold marker:text-fk-fiordo">{children}</ol>;
}

function Codigo({ children }: { children: ReactNode }) {
  return <code className="rounded-fk bg-fk-niebla px-1.5 py-0.5 font-mono text-[13px]">{children}</code>;
}

function BotonArca({ cuit }: { cuit: string }) {
  return (
    <a
      href={URL_ARCA}
      target="_blank"
      rel="noreferrer"
      title={`Entrá con la clave fiscal del CUIT ${formatearCuit(cuit)}`}
      className="inline-flex min-h-10 items-center gap-2 rounded-fk border border-fk-fiordo px-4 text-sm font-semibold text-fk-fiordo hover:bg-fk-niebla"
    >
      Abrir ARCA
      <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden />
    </a>
  );
}

// ── Pasos ────────────────────────────────────────────────────────────────

function PasoGenerar({
  emisor,
  alias,
  onAlias,
  onGenerada,
  generadaAhora,
}: {
  emisor: Emisor & { cuit: string; razonSocial: string };
  alias: string;
  onAlias: (alias: string) => void;
  onGenerada: (clavePem: string) => void;
  generadaAhora: boolean;
}) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function generar() {
    setError(null);
    setGenerando(true);
    try {
      const r = await generarPedidoCertificado({ razonSocial: emisor.razonSocial, cuit: emisor.cuit, alias });
      descargarTexto(`${alias}.key`, r.clavePrivadaPem);
      descargarTexto(`${alias}.csr`, r.csrPem);
      onGenerada(r.clavePrivadaPem);
    } catch (err) {
      setError(err);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Nombre del certificado" className="w-56">
          <Entrada value={alias} onChange={(e) => onAlias(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} maxLength={30} />
        </Campo>
        <Boton variante="secundario" onClick={() => void generar()} cargando={generando} disabled={!alias}>
          <KeyRound className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Crear y descargar
        </Boton>
        <Ayuda etiqueta="Qué se descarga">
          Dos archivos: <strong>{alias}.key</strong> (tu clave privada, como una firma) y <strong>{alias}.csr</strong> (el pedido que le
          subís a ARCA). Se crean en tu navegador, a nombre de {emisor.razonSocial} ({formatearCuit(emisor.cuit)}). La clave no sale de tu
          computadora hasta que la subas en el paso 5.
        </Ayuda>
      </div>
      <AlertaError error={error} />
      {generadaAhora && (
        <Aviso tono="verde">
          Descargados. Guardá <strong>{alias}.key</strong> en un lugar seguro: si lo perdés, hay que empezar de nuevo.
        </Aviso>
      )}
    </div>
  );
}

function PasoPedirCertificado({ cuit, alias }: { cuit: string; alias: string }) {
  return (
    <div className="space-y-4">
      <BotonArca cuit={cuit} />
      <Acciones>
        <li>
          Entrá a <strong>Administración de Certificados Digitales</strong>
          <Ayuda etiqueta="No encuentro el servicio" className="ml-1">
            Adherilo desde <strong>Administrador de Relaciones de Clave Fiscal</strong> → Adherir servicio → ARCA → Servicios interactivos.
            Si dice que “arfe_certificado” ya existe, ya estaba adherido: buscalo en Mis servicios.
          </Ayuda>
        </li>
        <li>
          <strong>Agregar alias</strong>: <Codigo>{alias}</Codigo> + el archivo <strong>{alias}.csr</strong>
        </li>
        <li>
          Tocá <strong>Ver</strong> y descargá el <strong>.crt</strong>
        </li>
      </Acciones>
    </div>
  );
}

function PasoAutorizar({ cuit, alias }: { cuit: string; alias: string }) {
  return (
    <div className="space-y-4">
      <BotonArca cuit={cuit} />
      <Acciones>
        <li>
          <strong>Administrador de Relaciones de Clave Fiscal</strong> → <strong>Nueva relación</strong>
        </li>
        <li>
          Buscar → ARCA → WebServices → <strong>Facturación Electrónica</strong>
        </li>
        <li>
          Representante: elegí <Codigo>{alias}</Codigo> y <strong>Confirmar</strong>
          <Ayuda etiqueta="Por qué hace falta" className="ml-1">
            El certificado aparece como “computador fiscal”. Sin esta autorización, ARCA rechaza la conexión aunque el certificado esté
            bien.
          </Ayuda>
        </li>
      </Acciones>
    </div>
  );
}

function PasoPuntoVenta({
  cuit,
  monotributo,
  existente,
  onCreado,
}: {
  cuit: string;
  monotributo: boolean;
  existente: PuntoVenta | null;
  onCreado: () => void;
}) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState('');
  const crear = useMutation({
    mutationFn: () => pedir<PuntoVenta>('/configuracion/puntos-venta', 'POST', { numero: Number(numero), ambiente: 'PRODUCCION' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['puntos-venta'] });
      onCreado();
    },
  });

  if (existente) {
    return (
      <Aviso tono="verde">
        Usás el punto de venta <strong>{existente.numero}</strong>.
      </Aviso>
    );
  }

  const sistema = monotributo ? 'Factura Electrónica - Monotributo - Web Services' : 'RECE para aplicativo y web services';
  return (
    <div className="space-y-4">
      <BotonArca cuit={cuit} />
      <Acciones>
        <li>
          <strong>Administración de Puntos de Venta y Domicilios</strong> → A/B/M → <strong>Agregar</strong>
        </li>
        <li>
          Sistema: <strong>{sistema}</strong>
          <Ayuda etiqueta="Qué número y sistema elijo" className="ml-1">
            Un número que no uses (por ejemplo, el siguiente al último). Tiene que ser uno nuevo, solo para Faktia: los de “Factura en
            línea” no sirven para Web Services. Asociale tu domicilio fiscal.
          </Ayuda>
        </li>
      </Acciones>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          crear.mutate();
        }}
      >
        <Campo etiqueta="Número que creaste" className="w-44">
          <Entrada
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 5))}
            inputMode="numeric"
            placeholder="Ej.: 3"
            required
          />
        </Campo>
        <Boton type="submit" cargando={crear.isPending} disabled={!numero}>
          Guardar y seguir
        </Boton>
      </form>
      <AlertaError error={crear.error} />
    </div>
  );
}

type Archivo = { nombre: string; pem: string };

/** Caja para elegir (o soltar) un archivo: ícono, qué archivo va y, una vez elegido, su nombre con un tilde. */
function SelectorArchivo({
  titulo,
  detalle,
  accept,
  elegido,
  onElegido,
}: {
  titulo: string;
  detalle: string;
  accept: string;
  elegido: Archivo | null;
  onElegido: (a: Archivo) => void;
}) {
  const [encima, setEncima] = useState(false);

  async function tomar(archivo: File | undefined) {
    if (archivo) onElegido({ nombre: archivo.name, pem: await archivo.text() });
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        void tomar(e.dataTransfer.files?.[0]);
      }}
      className={`flex cursor-pointer items-center gap-3 rounded-fk border-2 border-dashed p-4 transition-colors ${
        elegido
          ? 'border-fk-ok-texto/40 bg-fk-ok-fondo/50'
          : encima
            ? 'border-fk-fiordo bg-fk-niebla'
            : 'border-fk-borde bg-fk-blanco hover:border-fk-fiordo/50 hover:bg-fk-niebla/40'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${elegido ? 'bg-fk-pino text-fk-blanco' : 'bg-fk-niebla text-fk-fiordo'}`}
      >
        {elegido ? <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden /> : <FileKey2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fk-grafito">{titulo}</span>
        <span className="block truncate text-xs text-fk-gris-texto">{elegido ? elegido.nombre : detalle}</span>
      </span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          void tomar(archivo);
        }}
      />
    </label>
  );
}

/**
 * Sube el certificado de producción (.crt de ARCA + .key). Lo usan el asistente y la carga a mano.
 * En homologación no hace falta certificado: se emite con el CUIT de prueba de AfipSDK.
 */
export function SubirCertificado({
  alias = 'faktia',
  claveGenerada = null,
  yaCargado,
  textoBoton = 'Subir certificado',
  onCargado,
}: {
  alias?: string;
  claveGenerada?: string | null;
  yaCargado: boolean;
  textoBoton?: string;
  onCargado?: () => void;
}) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [cert, setCert] = useState<Archivo | null>(null);
  const [clave, setClave] = useState<Archivo | null>(claveGenerada ? { nombre: `${alias}.key`, pem: claveGenerada } : null);
  const [listo, setListo] = useState(false);

  const cargar = useMutation({
    mutationFn: () =>
      pedir<Certificado>('/configuracion/certificados', 'POST', {
        ambiente: 'PRODUCCION',
        certificadoPem: cert?.pem.trim(),
        clavePrivadaPem: clave?.pem.trim(),
      }),
    onSuccess: async () => {
      setCert(null);
      setClave(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['certificados'] }),
        queryClient.invalidateQueries({ queryKey: ['arca'] }),
      ]);
      setListo(true);
      onCargado?.();
    },
  });

  function elegir(setter: (a: Archivo) => void) {
    return (a: Archivo) => {
      setter(a);
      setListo(false);
      cargar.reset();
    };
  }

  return (
    <div className="space-y-4">
      {yaCargado && !listo && <Aviso tono="azul">Ya tenés un certificado de producción. Si subís otro, lo reemplaza.</Aviso>}
      <div className="grid gap-3 md:grid-cols-2">
        <SelectorArchivo titulo="Certificado" detalle="El .crt que bajaste de ARCA" accept=".crt,.pem,.cer" elegido={cert} onElegido={elegir(setCert)} />
        <SelectorArchivo titulo="Clave privada" detalle={`El ${alias}.key que creaste`} accept=".key,.pem" elegido={clave} onElegido={elegir(setClave)} />
      </div>
      <div className="flex items-center gap-2">
        <Boton onClick={() => cargar.mutate()} cargando={cargar.isPending} disabled={!cert || !clave}>
          <Upload className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {textoBoton}
        </Boton>
        <Ayuda etiqueta="Qué se revisa">
          Que el certificado y la clave sean pareja, que no estén vencidos y que sean de tu CUIT. Se guardan cifrados. Podés arrastrar los
          archivos a cada caja.
        </Ayuda>
      </div>
      <AlertaError error={cargar.error} />
      {listo && <Aviso tono="verde">Certificado cargado.</Aviso>}
    </div>
  );
}

function PasoProduccion({ enProduccion }: { enProduccion: boolean }) {
  if (enProduccion) {
    return <Aviso tono="verde">¡Listo! Ya facturás con validez fiscal.</Aviso>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to="/configuracion?tab=produccion"
        className="inline-flex min-h-10 items-center gap-2 rounded-fk bg-fk-terracota px-4 text-sm font-semibold text-fk-blanco hover:opacity-90"
      >
        Probar y activar
        <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </Link>
      <Ayuda etiqueta="Qué pasa al activar">
        Primero se prueba la conexión con ARCA (solo consulta, no emite nada). Si da bien, activás producción y desde ahí los comprobantes
        tienen validez fiscal. Para la primera factura, conviene un cliente conocido y un importe chico.
      </Ayuda>
    </div>
  );
}
