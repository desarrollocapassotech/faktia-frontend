import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, BookOpen, Calculator, Copy, FileText, Grid2x2, HardHat, List, Plus, Share2, Trash2, UserPlus, type LucideIcon } from 'lucide-react';
import { CompartirModal } from '@/components/CompartirModal';
import { confirmarCambioEstado, confirmarDuplicado, confirmarEliminacion } from '@/pages/presupuestos/confirmaciones';
import { EditorTexto, TextoFormato } from '@/components/EditorTexto';
import {
  BarraAcciones,
  AlertaError,
  Aviso,
  Boton,
  BotonIcono,
  Campo,
  Cargando,
  EncabezadoPagina,
  Entrada,
  EntradaNumero,
  EtiquetaEstado,
  Modal,
  Selector,
  SelectorBuscable,
  Tarjeta,
} from '@/components/ui';
import { useAnimarMovimiento } from '@/lib/animarMovimiento';
import { dinero, ESTADOS_PRESUPUESTO, hoy, IVA_PRESUPUESTO, textoObservacion } from '@/lib/formato';
import { useEmpresa } from '@/lib/modulos';
import type { Cliente, EstadoPresupuesto, FormaCotizar, ItemBiblioteca, IvaPresupuesto, Moneda, ObservacionCatalogo, PreferenciasEmpresa, Presupuesto, Superficie } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { ClienteModal } from '@/pages/clientes/ClienteModal';
import { EditorPlan } from '@/pages/proyectos/EditorPlan';
import { hitosParaEnviar, sumaHitos, type HitoEditable } from '@/pages/proyectos/plan';
import { toast } from '@/lib/toasts';

const FORMAS: Array<{ id: FormaCotizar; texto: string; ayuda: string; icono: LucideIcon }> = [
  { id: 'POR_ITEM', texto: 'Por ítem', ayuda: 'Cada trabajo con su importe', icono: List },
  { id: 'GLOBAL', texto: 'Total global', ayuda: 'Varios trabajos, un solo total', icono: Calculator },
  { id: 'SUPERFICIE', texto: 'Por superficie', ayuda: 'Medidas y metros cuadrados', icono: Grid2x2 },
];
const ALICUOTAS = ['21', '10.5', '27', '5', '2.5', '0'];

interface ItemForm {
  clave: string;
  cantidad: string;
  descripcion: string;
  importe: string;
}
interface ObservacionForm {
  texto: string;
  valor: string;
  llevaValor: boolean;
  elegida: boolean;
}

let n = 0;
const nuevoItem = (descripcion = ''): ItemForm => ({ clave: `i${++n}`, cantidad: '', descripcion, importe: '' });

function sumarDias(ymd: string, dias: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Alta, edición y vista de un presupuesto (editable solo en borrador). */
export function PresupuestoPage() {
  const { id } = useParams();
  const { pedir } = useApi();
  const existente = useQuery({ queryKey: ['presupuesto', id], queryFn: () => pedir<Presupuesto>(`/presupuestos/${id}`), enabled: Boolean(id) });
  const catalogo = useQuery({ queryKey: ['presupuestos', 'observaciones'], queryFn: () => pedir<ObservacionCatalogo[]>('/presupuestos/biblioteca/observaciones') });
  const preferencias = useQuery({ queryKey: ['preferencias'], queryFn: () => pedir<PreferenciasEmpresa>('/configuracion/preferencias') });
  if (existente.error) return <AlertaError error={existente.error} />;
  if ((id && !existente.data) || !catalogo.data || !preferencias.data) return <Cargando />;
  return <Formulario key={existente.data ? `${existente.data.id}-${existente.data.estado}` : 'nuevo'} presupuesto={existente.data} catalogo={catalogo.data} diasValidez={preferencias.data.diasValidezPresupuesto} />;
}

function Formulario({ presupuesto, catalogo, diasValidez }: { presupuesto?: Presupuesto; catalogo: ObservacionCatalogo[]; diasValidez: number }) {
  const { pedir, verEnPestana } = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { etiqueta, etiquetaMin, tiene } = useEmpresa();
  const editable = !presupuesto || presupuesto.editable;
  const clientes = useQuery({ queryKey: ['clientes', 'todos'], queryFn: () => pedir<Cliente[]>('/clientes') });

  const [clienteId, setClienteId] = useState(presupuesto?.clienteId ?? '');
  const [altaCliente, setAltaCliente] = useState(false);
  const [fecha, setFecha] = useState(presupuesto?.fecha ?? hoy());
  const [vencimiento, setVencimiento] = useState(presupuesto?.fechaVencimiento ?? sumarDias(hoy(), diasValidez));
  const [vencimientoTocado, setVencimientoTocado] = useState(Boolean(presupuesto));
  const [titulo, setTitulo] = useState(presupuesto?.titulo ?? '');
  const [lugar, setLugar] = useState(presupuesto?.lugar ?? '');
  const [moneda, setMoneda] = useState<Moneda>(presupuesto?.moneda ?? 'ARS');
  const [forma, setForma] = useState<FormaCotizar>(presupuesto?.formaCotizar ?? 'POR_ITEM');
  const [superficie, setSuperficie] = useState<Superficie>(presupuesto?.superficie ?? {});
  const [importeGlobal, setImporteGlobal] = useState(presupuesto?.importeGlobal ?? '');
  const [ivaModo, setIvaModo] = useState<IvaPresupuesto>(presupuesto?.ivaModo ?? 'NO_INCLUYE');
  const [alicuota, setAlicuota] = useState(presupuesto?.alicuotaIva ?? '21');
  const [items, setItems] = useState<ItemForm[]>(
    presupuesto?.items.map((i) => ({ clave: i.id, cantidad: i.cantidad ?? '', descripcion: i.descripcion, importe: i.importe ?? '' })) ?? [nuevoItem()],
  );
  const [observaciones, setObservaciones] = useState<ObservacionForm[]>(() => {
    const guardadas = presupuesto?.observaciones ?? [];
    const delCatalogo = catalogo.map((o) => {
      const g = guardadas.find((x) => x.texto === o.texto);
      return { texto: o.texto, llevaValor: o.llevaValor, elegida: presupuesto ? Boolean(g) : o.porDefecto, valor: g?.valor ?? o.valorSugerido ?? '' };
    });
    const extras = guardadas.filter((g) => !catalogo.some((o) => o.texto === g.texto)).map((g) => ({ texto: g.texto, llevaValor: Boolean(g.valor), elegida: true, valor: g.valor ?? '' }));
    return [...delCatalogo, ...extras];
  });
  const [notas, setNotas] = useState(presupuesto?.notas ?? '');
  const [biblioteca, setBiblioteca] = useState(false);
  const [crearObra, setCrearObra] = useState(false);
  const [compartir, setCompartir] = useState(false);
  const [errorPdf, setErrorPdf] = useState<unknown>(null);

  useEffect(() => {
    if (!vencimientoTocado && fecha) setVencimiento(sumarDias(fecha, diasValidez));
  }, [fecha, vencimientoTocado, diasValidez]);

  const m2 = Number(superficie.metrosCuadrados) || (Number(superficie.ancho) * Number(superficie.largo) || 0);
  const subtotal = useMemo(() => {
    if (forma === 'POR_ITEM') return items.reduce((s, i) => s + (Number(i.importe) || 0), 0);
    if (forma === 'SUPERFICIE' && Number(superficie.precioMetroCuadrado)) return Math.round(m2 * Number(superficie.precioMetroCuadrado) * 100) / 100;
    return Number(importeGlobal) || 0;
  }, [forma, items, importeGlobal, superficie.precioMetroCuadrado, m2]);
  // No se agrega un ítem nuevo mientras haya alguno sin descripción (o sin importe, al cotizar por ítem).
  const hayIncompletos = items.some((i) => !i.descripcion.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || (forma === 'POR_ITEM' && !i.importe));
  const iva = ivaModo === 'DISCRIMINADO' ? Math.round(subtotal * Number(alicuota)) / 100 : 0;

  const body = () => ({
    clienteId,
    fecha,
    fechaVencimiento: vencimiento,
    titulo: titulo.trim() || undefined,
    lugar: lugar.trim() || undefined,
    moneda,
    formaCotizar: forma,
    superficie: forma === 'SUPERFICIE' ? Object.fromEntries(Object.entries(superficie).filter(([, v]) => v)) : null,
    importeGlobal: forma !== 'POR_ITEM' && importeGlobal ? Number(importeGlobal).toFixed(2) : null,
    ivaModo,
    alicuotaIva: alicuota,
    items: items
      .filter((i) => i.descripcion.replace(/<[^>]*>/g, '').trim())
      .map((i) => ({ cantidad: i.cantidad.trim() || undefined, descripcion: i.descripcion, importe: forma === 'POR_ITEM' && i.importe ? Number(i.importe).toFixed(2) : null })),
    observaciones: observaciones.filter((o) => o.elegida).map((o) => ({ texto: o.texto, ...(o.valor.trim() ? { valor: o.valor.trim() } : {}) })),
    notas: notas.replace(/<[^>]*>/g, '').trim() ? notas : undefined,
  });

  const alGuardar = (p: Presupuesto) => {
    queryClient.setQueryData(['presupuesto', p.id], p);
    void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
    if (!presupuesto) navigate(`/presupuestos/${p.id}`, { replace: true });
  };
  const guardar = useMutation({
    meta: { exito: presupuesto ? 'Cambios guardados.' : 'Presupuesto creado.', error: 'No se pudo guardar el presupuesto.' },
    mutationFn: () => (presupuesto ? pedir<Presupuesto>(`/presupuestos/${presupuesto.id}`, 'PUT', body()) : pedir<Presupuesto>('/presupuestos', 'POST', body())),
    onSuccess: alGuardar,
  });
  // Al cambiar el cliente se borra el error del último guardado (ej.: "Elegí un cliente.").
  const elegirCliente = (id: string) => {
    setClienteId(id);
    guardar.reset();
  };
  const estado = useMutation({
    meta: { error: 'No se pudo cambiar el estado.' },
    mutationFn: (e: Exclude<EstadoPresupuesto, 'VENCIDO'>) => pedir<Presupuesto>(`/presupuestos/${presupuesto!.id}/estado`, 'PATCH', { estado: e }),
    onSuccess: (p, e) => {
      const mensajes = { BORRADOR: 'Volvió a borrador.', ENVIADO: 'Presupuesto marcado como enviado.', ACEPTADO: 'Presupuesto aceptado.', RECHAZADO: 'Presupuesto rechazado.' };
      toast.exito(mensajes[e]);
      alGuardar(p);
    },
  });
  const duplicar = useMutation({
    meta: { exito: 'Presupuesto duplicado.', error: 'No se pudo duplicar el presupuesto.' },
    mutationFn: (reemplaza: boolean) => pedir<Presupuesto>(`/presupuestos/${presupuesto!.id}/duplicar`, 'POST', { reemplaza }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
      void queryClient.invalidateQueries({ queryKey: ['presupuesto', presupuesto!.id] });
      navigate(`/presupuestos/${p.id}`);
    },
  });
  const eliminar = useMutation({
    meta: { exito: 'Borrador eliminado.', error: 'No se pudo eliminar el presupuesto.' },
    mutationFn: () => pedir(`/presupuestos/${presupuesto!.id}`, 'DELETE'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
      navigate('/presupuestos', { replace: true });
    },
  });

  // Acciones importantes: siempre con confirmación (pages/presupuestos/confirmaciones.ts).
  async function cambiarEstado(nuevo: Exclude<EstadoPresupuesto, 'VENCIDO'>) {
    if (presupuesto && (await confirmarCambioEstado(presupuesto.numero, nuevo))) estado.mutate(nuevo);
  }
  async function duplicarPresupuesto(reemplaza: boolean) {
    if (presupuesto && (await confirmarDuplicado(presupuesto.numero, reemplaza))) duplicar.mutate(reemplaza);
  }

  async function verPdf() {
    setErrorPdf(null);
    try {
      await verEnPestana(`/presupuestos/${presupuesto!.id}/pdf`);
    } catch (err) {
      setErrorPdf(err);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  const animarItems = useAnimarMovimiento();
  const mover = (i: number, d: -1 | 1) => {
    animarItems.capturar();
    setItems((xs) => {
      const c = [...xs];
      const [x] = c.splice(i, 1);
      c.splice(i + d, 0, x);
      return c;
    });
  };
  const sup = (k: keyof Superficie, v: string) => setSuperficie((s) => ({ ...s, [k]: v }));
  const $ = (v: number | string) => dinero(v, moneda);
  const e = presupuesto?.estado;

  return (
    <form onSubmit={enviar} className="space-y-6">
      <EncabezadoPagina
        titulo={presupuesto ? `Presupuesto ${presupuesto.numero}` : 'Nuevo presupuesto'}
        tituloEnBarra
        migas={[{ texto: 'Presupuestos', a: '/presupuestos' }, { texto: presupuesto ? presupuesto.numero : 'Nuevo presupuesto' }]}
        junto={e && <EtiquetaEstado estado={ESTADOS_PRESUPUESTO[e]} />}
        inicio={
          presupuesto && (
            <>
              {e === 'BORRADOR' && (
                <Boton variante="secundario" onClick={() => void cambiarEstado('ENVIADO')} cargando={estado.isPending && estado.variables === 'ENVIADO'}>
                  Marcar como enviado
                </Boton>
              )}
              {e === 'ENVIADO' && (
                <Boton variante="terciario" onClick={() => void cambiarEstado('BORRADOR')}>
                  Volver a borrador
                </Boton>
              )}
              {e && ['BORRADOR', 'ENVIADO', 'VENCIDO'].includes(e) && (
                <>
                  <Boton variante="secundario" onClick={() => void cambiarEstado('ACEPTADO')}>
                    Aceptado
                  </Boton>
                  <Boton variante="destructivo" onClick={() => void cambiarEstado('RECHAZADO')}>
                    Rechazado
                  </Boton>
                </>
              )}
              {e && ['ENVIADO', 'ACEPTADO'].includes(e) && !presupuesto.proyectoId && (
                <Boton variante="terciario" onClick={() => void duplicarPresupuesto(true)}>
                  Duplicar y reemplazar
                </Boton>
              )}
              {e === 'ACEPTADO' && tiene('proyectos') && (
                presupuesto.proyectoId ? (
                  <Boton variante="fantasma" onClick={() => navigate(`/proyectos/${presupuesto.proyectoId}`)}>
                    <HardHat className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Ver {etiquetaMin}
                  </Boton>
                ) : (
                  <Boton variante="secundario" onClick={() => setCrearObra(true)}>
                    <HardHat className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Crear {etiquetaMin}
                  </Boton>
                )
              )}
              {/* Aviso en la misma fila que los botones (si no entra, pasa abajo). */}
              {!editable && (
                <Aviso tono="azul">
                  {e === 'VENCIDO'
                    ? 'Venció sin aceptarse ni rechazarse. Duplicalo para mandarlo con fecha nueva.'
                    : 'Ya no es un borrador: para cambiarlo, duplicalo. El duplicado puede reemplazar a este (queda rechazado).'}
                </Aviso>
              )}
            </>
          )
        }
        acciones={
          presupuesto && (
            <>
              <Boton variante="terciario" onClick={() => void verPdf()}>
                <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Ver PDF
              </Boton>
              <Boton variante="terciario" cargando={duplicar.isPending && !duplicar.variables} onClick={() => void duplicarPresupuesto(false)}>
                <Copy className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Duplicar
              </Boton>
              <Boton variante="terciario" onClick={() => setCompartir(true)}>
                <Share2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Compartir
              </Boton>
            </>
          )
        }
      />
      <AlertaError error={errorPdf ?? estado.error ?? duplicar.error ?? eliminar.error} />

      <fieldset disabled={!editable} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <Tarjeta titulo="Cliente y trabajo">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Cliente" className="sm:col-span-2">
                <div className="flex gap-2">
                  <SelectorBuscable
                    value={clienteId}
                    onChange={elegirCliente}
                    placeholder="Elegí un cliente"
                    aria-label="Cliente"
                    opciones={(clientes.data ?? []).filter((c) => c.activo || c.id === clienteId).map((c) => ({ value: c.id, label: c.razonSocial }))}
                    className="flex-1"
                  />
                  {editable && (
                    <Boton variante="terciario" onClick={() => setAltaCliente(true)} className="shrink-0">
                      <UserPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      Nuevo
                    </Boton>
                  )}
                </div>
              </Campo>
              <Campo etiqueta="Trabajo">
                <Entrada value={titulo} onChange={(x) => setTitulo(x.target.value)} maxLength={200} placeholder="Cubierta de galpón" />
              </Campo>
              <Campo etiqueta={`${etiqueta} o lugar`}>
                <Entrada value={lugar} onChange={(x) => setLugar(x.target.value)} maxLength={300} placeholder="Costa Doll, Entre Ríos" />
              </Campo>
            </div>
          </Tarjeta>
          <Tarjeta titulo="Fechas y moneda">
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Fecha">
                <Entrada type="date" value={fecha} onChange={(x) => setFecha(x.target.value)} required />
              </Campo>
              <Campo etiqueta="Válido hasta" ayuda={editable ? `Por defecto, ${diasValidez} días.` : undefined}>
                <Entrada
                  type="date"
                  value={vencimiento}
                  onChange={(x) => {
                    setVencimiento(x.target.value);
                    setVencimientoTocado(true);
                  }}
                  required
                />
              </Campo>
              <Campo etiqueta="Moneda">
                <Selector value={moneda} onChange={(x) => setMoneda(x.target.value as Moneda)}>
                  <option value="ARS">Pesos</option>
                  <option value="USD">Dólares</option>
                </Selector>
              </Campo>
            </div>
          </Tarjeta>
        </div>

        {/* Sin título: las pestañas de forma de cotizar ocupan el encabezado de la tarjeta. */}
        <Tarjeta
          acciones={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label="Forma de cotizar" className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {FORMAS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={forma === f.id}
                    title={f.ayuda}
                    onClick={() => setForma(f.id)}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-fk px-3 text-sm whitespace-nowrap transition-colors ${
                      forma === f.id ? 'bg-fk-niebla font-semibold text-fk-fiordo' : 'font-medium text-fk-gris-texto hover:bg-fk-niebla/60 hover:text-fk-grafito'
                    }`}
                  >
                    <f.icono className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    {f.texto}
                  </button>
                ))}
              </div>
              {editable && (
                <Boton variante="terciario" onClick={() => setBiblioteca(true)}>
                  <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Agregar de la biblioteca
                </Boton>
              )}
            </div>
          }
        >
          <div className="space-y-3">
            {items.map((it, i) => (
              <section key={it.clave} ref={animarItems.ref(it.clave)} aria-label={`Ítem ${i + 1}`} className="overflow-hidden rounded-fk border border-fk-borde bg-fk-blanco">
                {/* Encabezado de cada ítem: número y acciones, sobre blanco roto para separar un ítem del otro. */}
                <header className="flex min-h-11 items-center justify-between gap-2 border-b border-fk-borde bg-fk-blanco-roto py-1 pr-1 pl-3">
                  <span className="fk-etiqueta tabular-nums">Ítem {i + 1}</span>
                  {editable && (
                    <div className="flex gap-1">
                      <BotonIcono etiqueta="Subir" icono={ArrowUp} disabled={i === 0} onClick={() => mover(i, -1)} />
                      <BotonIcono etiqueta="Bajar" icono={ArrowDown} disabled={i === items.length - 1} onClick={() => mover(i, 1)} />
                      <BotonIcono etiqueta="Quitar ítem" icono={Trash2} peligro onClick={() => setItems((xs) => xs.filter((y) => y.clave !== it.clave))} />
                    </div>
                  )}
                </header>
                <div className={`grid gap-3 p-3 md:items-start [&>*]:min-w-0 ${forma === 'POR_ITEM' ? 'md:grid-cols-[6rem_minmax(0,1fr)_11rem]' : 'md:grid-cols-[6rem_minmax(0,1fr)]'}`}>
                  <Campo etiqueta="Cantidad">
                    <Entrada value={it.cantidad} onChange={(x) => setItems((xs) => xs.map((y) => (y.clave === it.clave ? { ...y, cantidad: x.target.value } : y)))} maxLength={40} />
                  </Campo>
                  {editable ? (
                    <EditorTexto
                      rotulo="Descripción"
                      etiqueta={`Descripción del ítem ${i + 1}`}
                      minAlto="min-h-9"
                      value={it.descripcion}
                      onChange={(h) => setItems((xs) => xs.map((y) => (y.clave === it.clave ? { ...y, descripcion: h } : y)))}
                    />
                  ) : (
                    <div className="grid content-start gap-1.5">
                      <span className="text-[13px] font-semibold text-fk-grafito">Descripción</span>
                      <TextoFormato html={it.descripcion} className="rounded-fk border border-fk-borde px-3 py-2" />
                    </div>
                  )}
                  {forma === 'POR_ITEM' && (
                    <Campo etiqueta="Importe">
                      <EntradaNumero value={it.importe} onValueChange={(v) => setItems((xs) => xs.map((y) => (y.clave === it.clave ? { ...y, importe: v } : y)))} sinNegativos />
                    </Campo>
                  )}
                </div>
              </section>
            ))}
            {editable && (
              <div className="flex flex-wrap items-center gap-3">
                <Boton variante="terciario" disabled={hayIncompletos} onClick={() => setItems((xs) => [...xs, nuevoItem()])}>
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Agregar ítem
                </Boton>
                {hayIncompletos && (
                  <span className="text-xs text-fk-gris-texto">
                    {forma === 'POR_ITEM' ? 'Completá la descripción y el importe de los ítems para agregar otro.' : 'Completá la descripción de los ítems para agregar otro.'}
                  </span>
                )}
              </div>
            )}
          </div>

          {forma === 'SUPERFICIE' && (
            <div className="mt-6 grid gap-4 border-t border-fk-borde pt-5 sm:grid-cols-3 xl:grid-cols-6">
              <Campo etiqueta="Ancho (m)">
                <EntradaNumero value={superficie.ancho ?? ''} onValueChange={(v) => sup('ancho', v)} sinNegativos />
              </Campo>
              <Campo etiqueta="Largo (m)">
                <EntradaNumero value={superficie.largo ?? ''} onValueChange={(v) => sup('largo', v)} sinNegativos />
              </Campo>
              <Campo etiqueta="Altura lateral (m)">
                <EntradaNumero value={superficie.alturaLateral ?? ''} onValueChange={(v) => sup('alturaLateral', v)} sinNegativos />
              </Campo>
              <Campo etiqueta="Altura cumbrera (m)">
                <EntradaNumero value={superficie.alturaCumbrera ?? ''} onValueChange={(v) => sup('alturaCumbrera', v)} sinNegativos />
              </Campo>
              <Campo etiqueta="m² a cubrir" ayuda={!superficie.metrosCuadrados && m2 ? `Ancho × largo: ${m2}` : undefined}>
                <EntradaNumero value={superficie.metrosCuadrados ?? ''} onValueChange={(v) => sup('metrosCuadrados', v)} sinNegativos placeholder={m2 ? String(m2) : ''} />
              </Campo>
              <Campo etiqueta="Precio por m²" ayuda="O el total abajo.">
                <EntradaNumero value={superficie.precioMetroCuadrado ?? ''} onValueChange={(v) => sup('precioMetroCuadrado', v)} sinNegativos />
              </Campo>
            </div>
          )}
          {(forma === 'GLOBAL' || (forma === 'SUPERFICIE' && !Number(superficie.precioMetroCuadrado))) && (
            <Campo etiqueta="Importe total" className="mt-5 max-w-xs">
              <EntradaNumero value={importeGlobal} onValueChange={setImporteGlobal} sinNegativos />
            </Campo>
          )}
        </Tarjeta>

        <div className="grid gap-6 xl:grid-cols-2">
          <Tarjeta titulo="IVA y total">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="IVA">
                <Selector value={ivaModo} onChange={(x) => setIvaModo(x.target.value as IvaPresupuesto)}>
                  {Object.entries(IVA_PRESUPUESTO).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </Selector>
              </Campo>
              {ivaModo === 'DISCRIMINADO' && (
                <Campo etiqueta="Alícuota">
                  <Selector value={alicuota} onChange={(x) => setAlicuota(x.target.value)}>
                    {ALICUOTAS.map((a) => (
                      <option key={a} value={a}>
                        {a.replace('.', ',')}%
                      </option>
                    ))}
                  </Selector>
                </Campo>
              )}
            </div>
            <dl className="mt-5 space-y-2 border-t border-fk-borde pt-4 text-sm">
              {ivaModo === 'DISCRIMINADO' && (
                <>
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd className="fk-num">{$(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>IVA {alicuota.replace('.', ',')}%</dt>
                    <dd className="fk-num">{$(iva)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between text-base font-semibold text-fk-fiordo">
                <dt>{ivaModo === 'DISCRIMINADO' ? 'Total con IVA' : ivaModo === 'NO_INCLUYE' ? 'Total (no incluye IVA)' : 'Total'}</dt>
                <dd className="fk-num">{$(subtotal + iva)}</dd>
              </div>
            </dl>
          </Tarjeta>
          <Tarjeta titulo="Observaciones">
            <ul className="space-y-3">
              {observaciones.map((o, i) => (
                <li key={o.texto} className={`space-y-1 ${!editable && !o.elegida ? 'hidden' : ''}`}>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={o.elegida} onChange={(x) => setObservaciones((os) => os.map((y, j) => (j === i ? { ...y, elegida: x.target.checked } : y)))} />
                    <span>{textoObservacion({ texto: o.texto, valor: o.llevaValor ? o.valor : undefined })}</span>
                  </label>
                  {o.llevaValor && o.elegida && (
                    <Entrada
                      aria-label={`Valor de: ${o.texto}`}
                      value={o.valor}
                      onChange={(x) => setObservaciones((os) => os.map((y, j) => (j === i ? { ...y, valor: x.target.value } : y)))}
                      className="ml-6 max-w-md"
                      maxLength={300}
                    />
                  )}
                </li>
              ))}
              {observaciones.length === 0 && <li className="text-sm text-fk-gris-texto">El catálogo está vacío. Cargalo en la biblioteca.</li>}
            </ul>
            <div className="mt-5 space-y-2 border-t border-fk-borde pt-4">
              <span className="text-[13px] font-semibold text-fk-grafito">Notas</span>
              {editable ? <EditorTexto etiqueta="Notas" value={notas} onChange={setNotas} placeholder="Texto libre antes de las observaciones" /> : notas ? <TextoFormato html={notas} /> : <p className="text-sm text-fk-gris-texto">Sin notas.</p>}
            </div>
          </Tarjeta>
        </div>
      </fieldset>

      <AlertaError error={guardar.error} />
      <BarraAcciones>
        {presupuesto?.estado === 'BORRADOR' && (
          <Boton variante="destructivo" cargando={eliminar.isPending} onClick={async () => (await confirmarEliminacion(presupuesto.numero)) && eliminar.mutate()}>
            Eliminar
          </Boton>
        )}
        {editable && (
          <>
            <Boton variante="terciario" onClick={() => navigate('/presupuestos')}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={guardar.isPending} disabled={!clienteId}>
              {presupuesto ? 'Guardar cambios' : 'Guardar presupuesto'}
            </Boton>
          </>
        )}
      </BarraAcciones>

      {biblioteca && (
        <BibliotecaModal
          onCerrar={() => setBiblioteca(false)}
          onElegir={(elegidos) => {
            setItems((xs) => [...xs.filter((x) => x.descripcion.replace(/<[^>]*>/g, '').trim()), ...elegidos.map((b) => nuevoItem(b.descripcion))]);
            setBiblioteca(false);
          }}
        />
      )}
      {crearObra && presupuesto && <CrearObraModal presupuesto={presupuesto} onCerrar={() => setCrearObra(false)} />}
      {compartir && presupuesto && (
        <CompartirModal
          abierto
          onCerrar={() => setCompartir(false)}
          titulo={`Compartir presupuesto ${presupuesto.numero}`}
          rutaPdf={`/presupuestos/${presupuesto.id}/pdf`}
          nombreArchivo={`Presupuesto_${presupuesto.numero}.pdf`}
          mensaje={`Presupuesto${presupuesto.titulo ? `: ${presupuesto.titulo}` : ''} (PDF adjunto).`}
          emailSugerido={clientes.data?.find((c) => c.id === presupuesto.clienteId)?.email}
          enviarEmail={(datos) => pedir(`/presupuestos/${presupuesto.id}/enviar-email`, 'POST', datos)}
          avisoAlCompartir={presupuesto.estado === 'BORRADOR' ? 'El presupuesto queda marcado como enviado.' : undefined}
          onCompartido={(medio) => {
            // Mandarlo desde el sistema lo marca como enviado si era un borrador. Por email lo hace el
            // backend (acá solo se refresca); por WhatsApp no hay confirmación del servidor: se marca acá.
            if (medio === 'email') {
              void queryClient.invalidateQueries({ queryKey: ['presupuesto', presupuesto.id] });
              void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
            } else if (presupuesto.estado === 'BORRADOR') {
              estado.mutate('ENVIADO');
            }
          }}
        />
      )}
      <ClienteModal
        abierto={altaCliente}
        valoresIniciales={{ tipoDocumento: 'CONSUMIDOR_FINAL', condicionIva: 'CONSUMIDOR_FINAL' }}
        onCerrar={() => setAltaCliente(false)}
        onGuardado={(c) => {
          void queryClient.invalidateQueries({ queryKey: ['clientes'] });
          elegirCliente(c.id);
          setAltaCliente(false);
        }}
      />
    </form>
  );
}

/** Elegir ítems frecuentes: se copian al presupuesto (editarlos ahí no cambia la biblioteca). */
function BibliotecaModal({ onCerrar, onElegir }: { onCerrar: () => void; onElegir: (items: ItemBiblioteca[]) => void }) {
  const { pedir } = useApi();
  const { data, error } = useQuery({ queryKey: ['presupuestos', 'biblioteca'], queryFn: () => pedir<ItemBiblioteca[]>('/presupuestos/biblioteca/items') });
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const visibles = (data ?? []).filter((i) => !q || `${i.titulo} ${i.categoria ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal abierto titulo="Agregar de la biblioteca" onCerrar={onCerrar}>
      <div className="space-y-4">
        <AlertaError error={error} />
        <Entrada type="search" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        {!data ? (
          <Cargando />
        ) : data.length === 0 ? (
          <p className="text-sm text-fk-gris-texto">La biblioteca está vacía. Cargá los ítems frecuentes desde Presupuestos → Biblioteca.</p>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-fk-borde overflow-y-auto">
            {visibles.map((i) => (
              <li key={i.id}>
                <label className="flex cursor-pointer items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={elegidos.includes(i.id)}
                    onChange={(e) => setElegidos((xs) => (e.target.checked ? [...xs, i.id] : xs.filter((x) => x !== i.id)))}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{i.titulo}</span>
                    {i.categoria && <span className="block text-xs text-fk-gris-texto">{i.categoria}</span>}
                    <TextoFormato html={i.descripcion} className="mt-1 text-fk-gris-texto" />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton disabled={!elegidos.length} onClick={() => onElegir((data ?? []).filter((i) => elegidos.includes(i.id)))}>
            Agregar {elegidos.length || ''}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/** Crear la obra desde el presupuesto aceptado: el acordado sale del total y los hitos de la condición de pago. */
function CrearObraModal({ presupuesto, onCerrar }: { presupuesto: Presupuesto; onCerrar: () => void }) {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { etiquetaMin } = useEmpresa();
  const acordado = presupuesto.ivaModo === 'NO_INCLUYE' ? presupuesto.subtotal : presupuesto.total;
  const condicion = presupuesto.observaciones.find((o) => o.texto.toLowerCase().startsWith('condición de pago'));
  const [nombre, setNombre] = useState(presupuesto.titulo ?? presupuesto.lugar ?? '');
  const [hitos, setHitos] = useState<HitoEditable[]>([]);
  const descuadre = hitos.length > 0 && Math.abs(sumaHitos(hitos) - Number(acordado)) > 0.004;
  const crear = useMutation({
    meta: { exito: `Listo: ${etiquetaMin} en marcha.`, error: `No se pudo crear: ${etiquetaMin}.` },
    mutationFn: () => pedir<{ proyectoId: string }>(`/presupuestos/${presupuesto.id}/proyecto`, 'POST', { nombre: nombre.trim() || undefined, hitos: hitosParaEnviar(hitos) }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      void queryClient.invalidateQueries({ queryKey: ['presupuesto', presupuesto.id] });
      navigate(`/proyectos/${r.proyectoId}`);
    },
  });
  return (
    <Modal abierto titulo={`Crear ${etiquetaMin}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <Campo etiqueta="Nombre">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
        </Campo>
        <p className="text-sm text-fk-gris-texto">
          Monto acordado: <strong className="tabular-nums">{dinero(acordado, presupuesto.moneda)}</strong>
          {presupuesto.ivaModo === 'NO_INCLUYE' ? ' más IVA.' : ' (precio final).'}
        </p>
        {condicion && <Aviso tono="azul">{textoObservacion(condicion)}</Aviso>}
        <EditorPlan hitos={hitos} onCambiar={setHitos} montoAcordado={acordado} moneda={presupuesto.moneda} />
        <AlertaError error={crear.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={() => crear.mutate()} cargando={crear.isPending} disabled={descuadre}>
            Crear {etiquetaMin}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
