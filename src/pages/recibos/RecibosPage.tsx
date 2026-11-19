import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AlertaError, Aviso, Boton, BotonIcono, Campo, Cargando, claseInput, Entrada, EntradaNumero, Selector, SelectorBuscable, Tarjeta } from '@/components/ui';
import { cuit, dinero, fecha, hoy, numeroComprobante, tipoLargo } from '@/lib/formato';
import type { Cliente, ComprobanteResumen, Moneda, Paginado } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/auth/auth-context';

export type TipoRecibo = 'COBRO' | 'PAGO';
type Tipo = TipoRecibo;

interface Item {
  descripcion: string;
  cantidad: string;
  importe: string;
}

interface Aplicado {
  id: string;
  descripcion: string;
  importe: string;
}

const MONTO = /^\d{1,13}(\.\d{1,2})?$/;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MEDIOS = ['Transferencia bancaria', 'Efectivo', 'Cheque', 'Mercado Pago', 'Tarjeta'];

/** "1.234,5" o "1234,5" → "1234.5" */
function normalizarMonto(v: string): string {
  const t = v.trim().replace(/\s/g, '');
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
}

function aCentavos(v: string): number | null {
  const n = normalizarMonto(v);
  if (!MONTO.test(n)) return null;
  const [e, d = ''] = n.split('.');
  return Number(e) * 100 + Number(d.padEnd(2, '0'));
}

function deCentavos(c: number): string {
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

/** Concepto nuevo: la cantidad arranca en 1 (es obligatoria). */
const conceptoVacio = (): Item => ({ descripcion: '', cantidad: '1', importe: '' });

/** Obligatoria y mayor a 0 (vacía también es inválida). */
function cantidadInvalida(v: string): boolean {
  return !(Number(v) > 0);
}

function periodoDe(ymd: string): string {
  return `${MESES[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}`;
}

function documentoDe(c: Cliente): string {
  if (c.tipoDocumento === 'CONSUMIDOR_FINAL') return '';
  return `${c.tipoDocumento} ${c.tipoDocumento === 'CUIT' || c.tipoDocumento === 'CUIL' ? cuit(c.numeroDocumento) : c.numeroDocumento}`;
}

// Numeración: la lleva el usuario (no se guardan recibos). Recordamos el último número por tipo en
// este navegador solo para sugerir el siguiente. Por empresa: cada una lleva su numeración.
const CLAVE_NUMERO = (tenantId: string, t: Tipo) => `faktia.recibo.ultimoNumero.${tenantId}.${t}`;

function leerUltimo(tenantId: string, t: Tipo): string {
  try {
    return localStorage.getItem(CLAVE_NUMERO(tenantId, t)) ?? '';
  } catch {
    return '';
  }
}

function guardarUltimo(tenantId: string, t: Tipo, numero: string) {
  try {
    localStorage.setItem(CLAVE_NUMERO(tenantId, t), numero);
  } catch {
    // almacenamiento no disponible: no pasa nada
  }
}

const PRIMER_NUMERO = '0001-00000001';

/**
 * "0001-00000041" → "0001-00000042"; "R-7" → "R-8". Sin recibos anteriores, el primero
 * (0001-00000001). Si el último no termina en número, no sugiere.
 */
function siguienteNumero(ultimo: string): string {
  if (!ultimo.trim()) return PRIMER_NUMERO;
  const m = /^(.*?)(\d+)$/.exec(ultimo);
  if (!m) return '';
  const siguiente = String(Number(m[2]) + 1).padStart(m[2].length, '0');
  return `${m[1]}${siguiente}`;
}

/**
 * Formulario de un recibo (PDF; no se guarda ni va a ARCA). Vive en Nuevo comprobante → Recibo.
 * Cambiar de tipo es montarlo de nuevo (con `key`): arranca vacío, con el número sugerido de ese tipo.
 */
export function FormularioRecibo({ tipo }: { tipo: Tipo }) {
  const { pedir, descargar } = useApi();
  const tenantId = useAuth().tenant?.id ?? 'sin-empresa';
  const [numero, setNumero] = useState(() => siguienteNumero(leerUltimo(tenantId, tipo)));
  const [fechaRecibo, setFechaRecibo] = useState(hoy());
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [clienteId, setClienteId] = useState('');
  const [contraparte, setContraparte] = useState({ nombre: '', documento: '', domicilio: '' });
  const [items, setItems] = useState<Item[]>(() => [conceptoVacio()]);
  const [aplicados, setAplicados] = useState<Aplicado[]>([]);
  const [periodo, setPeriodo] = useState(() => periodoDe(hoy()));
  const [medioPago, setMedioPago] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [generando, setGenerando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);

  const clientes = useQuery({
    queryKey: ['clientes', { q: '', inactivos: false }],
    queryFn: () => pedir<Cliente[]>('/clientes?'),
    enabled: tipo === 'COBRO',
  });
  const facturas = useQuery({
    queryKey: ['comprobantes', { clienteId, estado: 'EMITIDO' }],
    queryFn: () => pedir<Paginado<ComprobanteResumen>>(`/comprobantes?estado=EMITIDO&porPagina=50&clienteId=${encodeURIComponent(clienteId)}`),
    enabled: tipo === 'COBRO' && Boolean(clienteId),
  });

  const opcionesClientes = useMemo(
    () =>
      (clientes.data ?? [])
        .map((c) => ({ value: c.id, label: c.razonSocial }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })),
    [clientes.data],
  );

  const centavos = items.map((i) => aCentavos(i.importe));
  // Subtotal = cantidad × importe (cantidad vacía = 1), redondeado al centavo. El total es la suma de los subtotales.
  const subtotales = items.map((it, i) => {
    const c = centavos[i];
    return c === null || cantidadInvalida(it.cantidad) ? null : Math.round(Number(it.cantidad) * c);
  });
  // No se agrega otro concepto mientras alguno no tenga descripción e importe válido.
  const hayIncompletos = items.some((it, i) => !it.descripcion.trim() || !subtotales[i]);
  const total = subtotales.every((s) => s !== null) ? subtotales.reduce<number>((s, c) => s + (c ?? 0), 0) : null;

  function elegirCliente(id: string) {
    setClienteId(id);
    setAplicados([]);
    const c = clientes.data?.find((x) => x.id === id);
    if (c) {
      setContraparte({ nombre: c.razonSocial, documento: documentoDe(c), domicilio: c.domicilio ?? '' });
      setMoneda(c.monedaPreferida);
    }
  }

  function alternarFactura(f: ComprobanteResumen) {
    const descripcion = `${tipoLargo(f.tipo)} ${numeroComprobante(f.puntoVenta.numero, f.numero)}`;
    if (aplicados.some((a) => a.id === f.id)) {
      setAplicados((a) => a.filter((x) => x.id !== f.id));
      setItems((its) => {
        const resto = its.filter((i) => i.descripcion !== `Pago ${descripcion}`);
        return resto.length ? resto : [conceptoVacio()];
      });
      return;
    }
    const importe = Number(f.importeTotal).toFixed(2);
    setAplicados((a) => [...a, { id: f.id, descripcion: `${descripcion} del ${fecha(f.fechaEmision)}`, importe }]);
    // Sugiere cobrar el total; si es un pago parcial, se corrige el importe del concepto.
    setItems((its) => [...its.filter((i) => i.descripcion.trim() || i.importe.trim()), { descripcion: `Pago ${descripcion}`, cantidad: '1', importe }]);
  }

  function cambiarItem(i: number, campo: keyof Item, valor: string) {
    setItems((its) => its.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));
  }

  async function generar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setListo(null);
    if (!contraparte.nombre.trim()) {
      setError(new Error(tipo === 'COBRO' ? 'Indicá quién paga.' : 'Indicá a quién le pagás.'));
      return;
    }
    const invalido = centavos.findIndex((c) => c === null);
    if (invalido >= 0) {
      setError(new Error(`Concepto ${invalido + 1}: el importe no es válido.`));
      return;
    }
    const sinCantidad = items.findIndex((it) => cantidadInvalida(it.cantidad));
    if (sinCantidad >= 0) {
      setError(new Error(`Concepto ${sinCantidad + 1}: la cantidad tiene que ser mayor a 0.`));
      return;
    }
    const body = {
      tipo,
      numero: numero.trim() || undefined,
      fecha: fechaRecibo,
      moneda,
      contraparte: {
        nombre: contraparte.nombre.trim(),
        documento: contraparte.documento.trim() || undefined,
        domicilio: contraparte.domicilio.trim() || undefined,
      },
      // El PDF muestra cantidad e importe de la línea (el subtotal).
      items: items.map((it, i) => ({
        descripcion: it.descripcion.trim(),
        cantidad: Number(it.cantidad).toLocaleString('es-AR'),
        importe: deCentavos(subtotales[i] ?? 0),
      })),
      total: deCentavos(total ?? 0),
      medioPago: medioPago.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
      ...(tipo === 'COBRO'
        ? { comprobantesAplicados: aplicados.map(({ descripcion, importe }) => ({ descripcion, importe })) }
        : { periodo: periodo.trim() || undefined }),
    };
    setGenerando(true);
    try {
      await descargar('/recibos/pdf', tipo === 'COBRO' ? 'Recibo-Cobro.pdf' : 'Recibo-Pago.pdf', body);
      if (numero.trim()) {
        guardarUltimo(tenantId, tipo, numero.trim());
        setNumero(siguienteNumero(numero.trim()));
      }
      setListo(numero.trim() ? `Recibo ${numero.trim()} generado.` : 'Recibo generado.');
    } catch (err) {
      setError(err);
    } finally {
      setGenerando(false);
    }
  }

  const esCobro = tipo === 'COBRO';

  return (
    <form onSubmit={generar} className="space-y-6">
      {/* Datos del recibo y de la contraparte en una sola tarjeta: dos filas en pantallas anchas. */}
      <Tarjeta>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-12">
          <Campo etiqueta="Número" className="lg:col-span-2">
            <Entrada value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={30} placeholder={PRIMER_NUMERO} title="El siguiente al último que generaste" />
          </Campo>
          <Campo etiqueta="Fecha" className="lg:col-span-2">
            <Entrada type="date" value={fechaRecibo} onChange={(e) => setFechaRecibo(e.target.value)} required />
          </Campo>
          <Campo etiqueta="Moneda" className="lg:col-span-2">
            <Selector value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </Selector>
          </Campo>
          {esCobro ? (
            <Campo etiqueta="Cliente" className="lg:col-span-6">
              <SelectorBuscable
                value={clienteId}
                onChange={elegirCliente}
                opciones={opcionesClientes}
                placeholder="Otro (cargar a mano)"
                placeholderBusqueda="Buscar cliente…"
              />
            </Campo>
          ) : (
            <Campo etiqueta="Período" className="lg:col-span-6">
              <Entrada value={periodo} onChange={(e) => setPeriodo(e.target.value)} maxLength={60} placeholder="Opcional" />
            </Campo>
          )}
          <Campo etiqueta={esCobro ? 'Quién paga' : 'A quién le pagás'} className="lg:col-span-4">
            <Entrada
              value={contraparte.nombre}
              onChange={(e) => setContraparte((p) => ({ ...p, nombre: e.target.value }))}
              maxLength={200}
              placeholder="Nombre o razón social"
              required
            />
          </Campo>
          <Campo etiqueta="Documento" className="lg:col-span-3">
            <Entrada
              value={contraparte.documento}
              onChange={(e) => setContraparte((p) => ({ ...p, documento: e.target.value }))}
              maxLength={60}
              placeholder="CUIT 20-12345678-9"
            />
          </Campo>
          <Campo etiqueta="Domicilio" className="sm:col-span-2 lg:col-span-5">
            <Entrada value={contraparte.domicilio} onChange={(e) => setContraparte((p) => ({ ...p, domicilio: e.target.value }))} maxLength={300} />
          </Campo>
        </div>
        {clientes.error != null && (
          <div className="mt-3">
            <AlertaError error={clientes.error} />
          </div>
        )}
      </Tarjeta>

      {esCobro && clienteId && (
        <Tarjeta titulo="Facturas que cancela">
          {facturas.error ? (
            <AlertaError error={facturas.error} />
          ) : !facturas.data ? (
            <Cargando texto="Cargando facturas…" />
          ) : facturas.data.items.filter((f) => f.tipo.startsWith('FACTURA')).length === 0 ? (
            <p className="text-sm text-fk-gris-texto">Este cliente no tiene facturas emitidas.</p>
          ) : (
            <ul className="-mx-4 divide-y divide-fk-borde text-sm sm:-mx-6">
              {facturas.data.items
                .filter((f) => f.tipo.startsWith('FACTURA'))
                .map((f) => (
                  <li key={f.id}>
                    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2 hover:bg-fk-niebla sm:px-6">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <input type="checkbox" checked={aplicados.some((a) => a.id === f.id)} onChange={() => alternarFactura(f)} />
                        {tipoLargo(f.tipo)} <span className="tabular-nums">{numeroComprobante(f.puntoVenta.numero, f.numero)}</span>
                        <span className="text-fk-gris-texto tabular-nums">{fecha(f.fechaEmision)}</span>
                      </span>
                      <span className="fk-num">{dinero(f.importeTotal, f.moneda)}</span>
                    </label>
                  </li>
                ))}
            </ul>
          )}
          {aplicados.length > 0 && (
            <p className="mt-3 text-xs text-fk-gris-texto">Si el pago es parcial, corregí el importe del concepto correspondiente.</p>
          )}
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Conceptos"
        acciones={
          <Boton
            variante="terciario"
            onClick={() => setItems((its) => [...its, conceptoVacio()])}
            disabled={items.length >= 200 || hayIncompletos}
            title={hayIncompletos ? 'Completá la descripción y el importe de los conceptos antes de agregar otro' : undefined}
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            Agregar concepto
          </Boton>
        }
      >
        {/* Una fila por concepto; los títulos de columna solo arriba (en mobile, cada campo lleva el suyo). */}
        <div className="hidden gap-3 pb-1.5 text-[13px] font-semibold text-fk-grafito sm:grid sm:grid-cols-12">
          <span className="sm:col-span-5">Descripción</span>
          <span className="sm:col-span-2">Cantidad</span>
          <span className="sm:col-span-2">Importe</span>
          <span className="text-right sm:col-span-2">Subtotal</span>
        </div>
        <div className="space-y-3 sm:space-y-2">
          {items.map((it, i) => {
            const importeMal = it.importe !== '' && centavos[i] === null;
            const cantidadMal = cantidadInvalida(it.cantidad);
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-12 sm:items-start sm:gap-3">
                <label className="sm:col-span-5">
                  <span className="mb-1 block text-[13px] font-semibold sm:sr-only">Descripción</span>
                  <Entrada value={it.descripcion} onChange={(e) => cambiarItem(i, 'descripcion', e.target.value)} maxLength={500} required />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-[13px] font-semibold sm:sr-only">Cantidad</span>
                  <EntradaNumero
                    value={it.cantidad}
                    onValueChange={(v) => cambiarItem(i, 'cantidad', v)}
                    required
                    sinNegativos
                    aria-invalid={cantidadMal}
                  />
                  {cantidadMal && <span className="mt-1 block text-[13px] text-fk-error-texto">Tiene que ser mayor a 0.</span>}
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-[13px] font-semibold sm:sr-only">Importe</span>
                  <EntradaNumero value={it.importe} onValueChange={(v) => cambiarItem(i, 'importe', v)} required sinNegativos aria-invalid={importeMal} />
                  {importeMal && <span className="mt-1 block text-[13px] text-fk-error-texto">Importe no válido.</span>}
                </label>
                <div className="flex min-h-10 items-center justify-between gap-2 sm:col-span-2 sm:justify-end">
                  <span className="text-[13px] font-semibold sm:sr-only">Subtotal</span>
                  <span className="fk-num font-medium text-fk-grafito">{subtotales[i] === null ? '—' : dinero(subtotales[i] / 100, moneda)}</span>
                </div>
                <div className="flex justify-end sm:col-span-1">
                  <BotonIcono
                    etiqueta={`Quitar concepto ${i + 1}`}
                    icono={Trash2}
                    peligro
                    onClick={() => setItems((its) => its.filter((_, j) => j !== i))}
                    disabled={items.length === 1}
                    className="mt-1"
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* Misma grilla que las filas: el total queda bajo la columna Subtotal. */}
        <div className="mt-5 grid items-baseline gap-3 border-t border-fk-borde pt-4 sm:grid-cols-12">
          <span className="text-right text-sm text-fk-gris-texto sm:col-span-9">Total</span>
          <span className="fk-num text-right text-lg font-semibold text-fk-fiordo sm:col-span-2">
            {total === null ? '—' : dinero(total / 100, moneda)}
          </span>
        </div>
      </Tarjeta>

      <Tarjeta>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-12">
          <Campo etiqueta="Medio de pago" className="sm:col-span-4">
            <Entrada list="medios-pago" value={medioPago} onChange={(e) => setMedioPago(e.target.value)} maxLength={100} placeholder="Opcional" />
            <datalist id="medios-pago">
              {MEDIOS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Campo>
          <Campo etiqueta="Observaciones" className="sm:col-span-8">
            <textarea
              rows={1}
              className={`${claseInput} min-h-10 resize-y`}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              maxLength={1000}
              placeholder="Opcional"
            />
          </Campo>
        </div>
      </Tarjeta>

      <AlertaError error={error} />
      {listo && <Aviso tono="verde">{listo}</Aviso>}
      <div className="flex justify-end">
        <Boton type="submit" cargando={generando} disabled={total === null || total <= 0}>
          Generar PDF
        </Boton>
      </div>
    </form>
  );
}
