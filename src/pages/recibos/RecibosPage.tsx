import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { HandCoins, Wallet } from 'lucide-react';
import { AlertaError, Aviso, Boton, Campo, Cargando, claseInput, EncabezadoPagina, Entrada, EntradaNumero, Selector, Tarjeta } from '@/components/ui';
import { cuit, dinero, fecha, hoy, numeroComprobante, tipoLargo } from '@/lib/formato';
import type { Cliente, ComprobanteResumen, Moneda, Paginado } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

type Tipo = 'COBRO' | 'PAGO';

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

function periodoDe(ymd: string): string {
  return `${MESES[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}`;
}

function documentoDe(c: Cliente): string {
  if (c.tipoDocumento === 'CONSUMIDOR_FINAL') return '';
  return `${c.tipoDocumento} ${c.tipoDocumento === 'CUIT' || c.tipoDocumento === 'CUIL' ? cuit(c.numeroDocumento) : c.numeroDocumento}`;
}

// Numeración: la lleva el usuario (no se guardan recibos). Recordamos el último número por tipo en
// este navegador solo para sugerir el siguiente.
const CLAVE_NUMERO = (t: Tipo) => `faktia.recibo.ultimoNumero.${t}`;

function leerUltimo(t: Tipo): string {
  try {
    return localStorage.getItem(CLAVE_NUMERO(t)) ?? '';
  } catch {
    return '';
  }
}

function guardarUltimo(t: Tipo, numero: string) {
  try {
    localStorage.setItem(CLAVE_NUMERO(t), numero);
  } catch {
    // almacenamiento no disponible: no pasa nada
  }
}

/** "0001-00000041" → "0001-00000042"; "R-7" → "R-8". Si no termina en número, no sugiere. */
function siguienteNumero(ultimo: string): string {
  const m = /^(.*?)(\d+)$/.exec(ultimo);
  if (!m) return '';
  const siguiente = String(Number(m[2]) + 1).padStart(m[2].length, '0');
  return `${m[1]}${siguiente}`;
}

export function RecibosPage() {
  const { pedir, descargar } = useApi();
  const [tipo, setTipo] = useState<Tipo>('COBRO');
  const [numero, setNumero] = useState(() => siguienteNumero(leerUltimo('COBRO')));
  const [fechaRecibo, setFechaRecibo] = useState(hoy());
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [clienteId, setClienteId] = useState('');
  const [contraparte, setContraparte] = useState({ nombre: '', documento: '', domicilio: '' });
  const [items, setItems] = useState<Item[]>([{ descripcion: '', cantidad: '', importe: '' }]);
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

  const centavos = items.map((i) => aCentavos(i.importe));
  const total = centavos.every((c) => c !== null) ? centavos.reduce<number>((s, c) => s + (c ?? 0), 0) : null;

  function cambiarTipo(t: Tipo) {
    setTipo(t);
    setNumero(siguienteNumero(leerUltimo(t)));
    setClienteId('');
    setContraparte({ nombre: '', documento: '', domicilio: '' });
    setAplicados([]);
    setItems([{ descripcion: '', cantidad: '', importe: '' }]);
    setError(null);
    setListo(null);
  }

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
        return resto.length ? resto : [{ descripcion: '', cantidad: '', importe: '' }];
      });
      return;
    }
    const importe = Number(f.importeTotal).toFixed(2);
    setAplicados((a) => [...a, { id: f.id, descripcion: `${descripcion} del ${fecha(f.fechaEmision)}`, importe }]);
    // Sugiere cobrar el total; si es un pago parcial, se corrige el importe del concepto.
    setItems((its) => [...its.filter((i) => i.descripcion.trim() || i.importe.trim()), { descripcion: `Pago ${descripcion}`, cantidad: '', importe }]);
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
      items: items.map((i) => ({
        descripcion: i.descripcion.trim(),
        cantidad: i.cantidad.trim() || undefined,
        importe: normalizarMonto(i.importe),
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
        guardarUltimo(tipo, numero.trim());
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
      <EncabezadoPagina
        titulo="Recibos"
        descripcion="Se generan en PDF con tus datos y tu logo. No se guardan ni son comprobantes de ARCA: llevá tu propia numeración."
      />

      <div role="radiogroup" aria-label="Tipo de recibo" className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['COBRO', 'Recibo de cobro', 'Un cliente te paga. Firmás vos.', HandCoins],
            ['PAGO', 'Recibo de pago', 'Le pagás a un colaborador o proveedor. Firma quien cobra.', Wallet],
          ] as const
        ).map(([t, titulo, ayuda, Icono]) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tipo === t}
            onClick={() => cambiarTipo(t)}
            className={`flex items-start gap-3 rounded-fk border bg-fk-blanco p-4 text-left transition-colors ${
              tipo === t ? 'border-fk-fiordo ring-1 ring-fk-fiordo' : 'border-fk-borde hover:border-fk-gris-texto'
            }`}
          >
            <Icono className={`mt-0.5 h-5 w-5 shrink-0 ${tipo === t ? 'text-fk-fiordo' : 'text-fk-gris-texto'}`} strokeWidth={1.75} aria-hidden />
            <span>
              <span className={`block text-[15px] font-semibold ${tipo === t ? 'text-fk-fiordo' : 'text-fk-grafito'}`}>{titulo}</span>
              <span className="mt-0.5 block text-[13px] text-fk-gris-texto">{ayuda}</span>
            </span>
          </button>
        ))}
      </div>

      {/* En pantallas anchas, los datos del recibo y la contraparte van lado a lado. */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Tarjeta titulo="Datos del recibo">
          <div className="grid gap-5 sm:grid-cols-3">
            <Campo etiqueta="Número" ayuda="Opcional. Se sugiere el siguiente al último que generaste.">
              <Entrada value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={30} placeholder="0001-00000001" />
            </Campo>
            <Campo etiqueta="Fecha">
              <Entrada type="date" value={fechaRecibo} onChange={(e) => setFechaRecibo(e.target.value)} required />
            </Campo>
            <Campo etiqueta="Moneda">
              <Selector value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </Selector>
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta titulo={esCobro ? 'Quién paga' : 'A quién le pagás'}>
          <div className="grid gap-5 sm:grid-cols-2">
            {esCobro && (
              <Campo etiqueta="Cliente" className="sm:col-span-2" ayuda="Elegilo para completar sus datos y ver sus facturas emitidas.">
                <Selector value={clienteId} onChange={(e) => elegirCliente(e.target.value)}>
                  <option value="">Otro (cargar a mano)</option>
                  {(clientes.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.razonSocial}
                    </option>
                  ))}
                </Selector>
              </Campo>
            )}
            <Campo etiqueta="Nombre o razón social">
              <Entrada value={contraparte.nombre} onChange={(e) => setContraparte((p) => ({ ...p, nombre: e.target.value }))} maxLength={200} required />
            </Campo>
            <Campo etiqueta="Documento" ayuda="Como querés que se lea: “CUIT 20-12345678-9”, “DNI 12.345.678”.">
              <Entrada value={contraparte.documento} onChange={(e) => setContraparte((p) => ({ ...p, documento: e.target.value }))} maxLength={60} />
            </Campo>
            <Campo etiqueta="Domicilio" className="sm:col-span-2">
              <Entrada value={contraparte.domicilio} onChange={(e) => setContraparte((p) => ({ ...p, domicilio: e.target.value }))} maxLength={300} />
            </Campo>
            {!esCobro && (
              <Campo etiqueta="Período" ayuda="Opcional. Se menciona en el texto del recibo.">
                <Entrada value={periodo} onChange={(e) => setPeriodo(e.target.value)} maxLength={60} />
              </Campo>
            )}
          </div>
          <div className="mt-3">
            <AlertaError error={clientes.error} />
          </div>
        </Tarjeta>
      </div>

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
          <Boton variante="terciario" onClick={() => setItems((its) => [...its, { descripcion: '', cantidad: '', importe: '' }])} disabled={items.length >= 200}>
            Agregar concepto
          </Boton>
        }
      >
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid gap-3 rounded-fk border border-fk-borde p-4 sm:grid-cols-12 sm:items-end">
              <Campo etiqueta="Descripción" className="sm:col-span-6">
                <Entrada value={it.descripcion} onChange={(e) => cambiarItem(i, 'descripcion', e.target.value)} maxLength={500} required />
              </Campo>
              <Campo etiqueta="Cantidad" ayuda="Opcional" className="sm:col-span-2">
                <Entrada value={it.cantidad} onChange={(e) => cambiarItem(i, 'cantidad', e.target.value)} maxLength={40} placeholder="80 hs" />
              </Campo>
              <Campo
                etiqueta="Importe"
                className="sm:col-span-3"
                error={it.importe !== '' && centavos[i] === null ? 'Importe no válido.' : null}
              >
                <EntradaNumero
                  value={it.importe}
                  onValueChange={(v) => cambiarItem(i, 'importe', v)}
                  required
                  aria-invalid={it.importe !== '' && centavos[i] === null}
                />
              </Campo>
              <div className="sm:col-span-1">
                <Boton
                  variante="fantasma"
                  onClick={() => setItems((its) => its.filter((_, j) => j !== i))}
                  disabled={items.length === 1}
                  aria-label={`Quitar concepto ${i + 1}`}
                >
                  Quitar
                </Boton>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-fk-borde pt-4 text-right text-sm text-fk-gris-texto">
          Total: <span className="fk-num text-lg font-semibold text-fk-fiordo">{total === null ? '—' : dinero(total / 100, moneda)}</span>
        </p>
      </Tarjeta>

      <Tarjeta titulo="Otros datos">
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Medio de pago" ayuda="Opcional.">
            <Entrada list="medios-pago" value={medioPago} onChange={(e) => setMedioPago(e.target.value)} maxLength={100} />
            <datalist id="medios-pago">
              {MEDIOS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Campo>
          <Campo etiqueta="Observaciones" ayuda="Opcional." className="sm:col-span-2">
            <textarea className={`${claseInput} h-20`} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={1000} />
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
