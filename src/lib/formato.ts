import type {
  EstadoPresupuesto,
  FormaCotizar,
  IvaPresupuesto,
  EstadoProyecto,
  ModoIvaProyecto,
  Ambiente,
  CondicionIva,
  Concepto,
  EstadoComprobante,
  EstadoImportacion,
  EstadoMovimientoCc,
  EstadoItem,
  Moneda,
  OrigenItem,
  Scope,
  TipoComprobante,
  TipoDocumento,
  TipoMovimientoCc,
  Unidad,
} from './tipos';

export const CONDICIONES_IVA: Record<CondicionIva, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
  MONOTRIBUTO: 'Monotributo',
  EXENTO: 'Exento',
  CONSUMIDOR_FINAL: 'Consumidor final',
  NO_CATEGORIZADO: 'No categorizado',
  PROVEEDOR_EXTERIOR: 'Proveedor del exterior',
  CLIENTE_EXTERIOR: 'Cliente del exterior',
  IVA_LIBERADO: 'IVA liberado (Ley 19.640)',
  MONOTRIBUTO_SOCIAL: 'Monotributo social',
  NO_ALCANZADO: 'IVA no alcanzado',
  MONOTRIBUTO_TIP: 'Monotributo trabajador independiente promovido',
};

export const TIPOS_DOCUMENTO: Record<TipoDocumento, string> = {
  CUIT: 'CUIT',
  CUIL: 'CUIL',
  DNI: 'DNI',
  PASAPORTE: 'Pasaporte',
  CONSUMIDOR_FINAL: 'Sin documento',
};

export const CONCEPTOS: Record<Concepto, string> = {
  PRODUCTOS: 'Productos',
  SERVICIOS: 'Servicios',
  PRODUCTOS_Y_SERVICIOS: 'Productos y servicios',
};

export const UNIDADES: Record<Unidad, string> = { HORA: 'Horas', UNIDAD: 'Unidades', SERVICIO: 'Servicio', MES: 'Mes' };

const UNIDAD_SINGULAR: Record<Unidad, string> = { HORA: 'hora', UNIDAD: 'unidad', SERVICIO: 'servicio', MES: 'mes' };
const UNIDAD_PLURAL: Record<Unidad, string> = { HORA: 'horas', UNIDAD: 'unidades', SERVICIO: 'servicios', MES: 'meses' };

/** "1 hora", "2,5 horas"; sin cantidad, el singular (para "$ 20 / hora"). */
export function unidadTexto(unidad: Unidad, cantidad?: string | number): string {
  return cantidad !== undefined && Number(cantidad) !== 1 ? UNIDAD_PLURAL[unidad] : UNIDAD_SINGULAR[unidad];
}

export const ALICUOTAS = ['21', '10.5', '27', '5', '2.5', '0'];

export const ORIGENES: Record<OrigenItem, string> = { TRACKER: 'Time tracker', API: 'API', EXCEL: 'Excel / CSV', MANUAL: 'Carga manual' };

export const SCOPES: Record<Scope, string> = {
  'acceso:emitir': 'Entrar a Faktia sin contraseña desde el otro sistema',
  'items:write': 'Cargar ítems a facturar',
  'comprobantes:write': 'Crear y emitir comprobantes',
  'comprobantes:read': 'Consultar comprobantes',
};

/** Tono de un badge o alerta (colores de estado de la marca). */
export type Tono = 'ok' | 'pendiente' | 'error' | 'info';

export interface Estado {
  texto: string;
  tono: Tono;
  tachado?: boolean;
}

export const ESTADOS_ITEM: Record<EstadoItem, Estado> = {
  VALIDO: { texto: 'Listo', tono: 'ok' },
  CON_ERRORES: { texto: 'Con errores', tono: 'error' },
  DUPLICADO: { texto: 'Duplicado', tono: 'info' },
  EN_BORRADOR: { texto: 'En borrador', tono: 'info' },
  FACTURADO: { texto: 'Facturado', tono: 'ok' },
  DESCARTADO: { texto: 'Descartado', tono: 'info', tachado: true },
};

export const ESTADOS_IMPORTACION: Record<EstadoImportacion, Estado> = {
  EN_STAGING: { texto: 'En revisión', tono: 'pendiente' },
  CONFIRMADA: { texto: 'Confirmada', tono: 'ok' },
  DESCARTADA: { texto: 'Descartada', tono: 'info' },
  FALLIDA: { texto: 'Fallida', tono: 'error' },
};

/** Estado de un movimiento de cuenta corriente: una factura se cobra; un cobro se imputa. */
export const ESTADOS_CC: Record<TipoMovimientoCc, Record<EstadoMovimientoCc, Estado>> = {
  DEBE: {
    PENDIENTE: { texto: 'Pendiente', tono: 'pendiente' },
    PARCIAL: { texto: 'Cobrado en parte', tono: 'pendiente' },
    CANCELADO: { texto: 'Cobrado', tono: 'ok' },
  },
  HABER: {
    PENDIENTE: { texto: 'A cuenta', tono: 'info' },
    PARCIAL: { texto: 'Imputado en parte', tono: 'info' },
    CANCELADO: { texto: 'Imputado', tono: 'ok' },
  },
};

export const VENCIDO: Estado = { texto: 'Vencido', tono: 'error' };

/** Saldos por moneda en una línea: "$ 1.200,00 · US$ 50,00"; sin saldos, "$ 0,00". */
export function saldosTexto(saldos: Array<{ moneda: Moneda; saldo?: string; total?: string }>): string {
  if (saldos.length === 0) return dinero(0);
  return saldos.map((s) => dinero(s.saldo ?? s.total ?? 0, s.moneda)).join(' · ');
}

/** "2026-09-28T13:04:00Z" → "28/09/2026 10:04" (hora de Argentina). */
export function fechaHora(v: string | null | undefined): string {
  if (!v) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(v));
}

/** "10.5000" → "10,5" */
export function cantidad(v: string | number): string {
  return Number(v).toLocaleString('es-AR', { maximumFractionDigits: 4 });
}

export const ESTADOS: Record<EstadoComprobante, Estado> = {
  BORRADOR: { texto: 'Borrador', tono: 'info' },
  EMITIENDO: { texto: 'Emitiendo…', tono: 'pendiente' },
  PENDIENTE_VERIFICACION: { texto: 'Verificando con ARCA', tono: 'pendiente' },
  EMITIDO: { texto: 'Emitido', tono: 'ok' },
  RECHAZADO: { texto: 'Rechazado', tono: 'error' },
  ANULADO: { texto: 'Anulado', tono: 'info', tachado: true },
};

const TIPOS: Record<TipoComprobante, { corto: string; largo: string; letra: 'A' | 'B' | 'C' }> = {
  FACTURA_A: { corto: 'FA', largo: 'Factura A', letra: 'A' },
  NOTA_DEBITO_A: { corto: 'NDA', largo: 'Nota de débito A', letra: 'A' },
  NOTA_CREDITO_A: { corto: 'NCA', largo: 'Nota de crédito A', letra: 'A' },
  FACTURA_B: { corto: 'FB', largo: 'Factura B', letra: 'B' },
  NOTA_DEBITO_B: { corto: 'NDB', largo: 'Nota de débito B', letra: 'B' },
  NOTA_CREDITO_B: { corto: 'NCB', largo: 'Nota de crédito B', letra: 'B' },
  FACTURA_C: { corto: 'FC', largo: 'Factura C', letra: 'C' },
  NOTA_DEBITO_C: { corto: 'NDC', largo: 'Nota de débito C', letra: 'C' },
  NOTA_CREDITO_C: { corto: 'NCC', largo: 'Nota de crédito C', letra: 'C' },
};

export function tipoLargo(t: TipoComprobante): string {
  return TIPOS[t].largo;
}

export function letraDe(t: TipoComprobante): 'A' | 'B' | 'C' {
  return TIPOS[t].letra;
}

export function esFactura(t: TipoComprobante): boolean {
  return t.startsWith('FACTURA');
}

/** Mismo tipo (factura / NC / ND) con otra letra. */
export function conLetra(t: TipoComprobante, letra: 'A' | 'B' | 'C'): TipoComprobante {
  return t.replace(/_[ABC]$/, `_${letra}`) as TipoComprobante;
}

/** Espejo de `sugerirLetra` del backend (domain/letra-sugerida.ts): solo sugiere, el usuario decide. */
export function sugerirLetra(emisor: CondicionIva, receptor: CondicionIva): 'A' | 'B' | 'C' {
  if (emisor !== 'RESPONSABLE_INSCRIPTO') return 'C';
  if (receptor === 'RESPONSABLE_INSCRIPTO' || receptor.startsWith('MONOTRIBUTO')) return 'A';
  return 'B';
}

export function ambienteTexto(a: Ambiente): string {
  return a === 'HOMOLOGACION' ? 'Homologación (pruebas)' : 'Producción';
}

export function dinero(v: string | number, moneda: Moneda = 'ARS'): string {
  const n = Number(v);
  return `${moneda === 'USD' ? 'US$' : '$'} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "2026-09-25T00:00:00.000Z" o "2026-09-25" → "25/09/2026" (las fechas de ARCA no tienen hora). */
export function fecha(v: string | null | undefined): string {
  if (!v) return '—';
  const [a, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function soloFecha(v: string | null | undefined): string {
  return v ? v.slice(0, 10) : '';
}

export function numeroComprobante(pv: number, numero: number | null): string {
  if (numero === null) return 'Sin número';
  return `${String(pv).padStart(5, '0')}-${String(numero).padStart(8, '0')}`;
}

export function cuit(v: string): string {
  return /^\d{11}$/.test(v) ? `${v.slice(0, 2)}-${v.slice(2, 10)}-${v.slice(10)}` : v;
}

/** "CUIT 20-12345678-9", "DNI 12345678" o "Consumidor final". */
export function documentoCliente(c: { tipoDocumento: TipoDocumento; numeroDocumento: string }): string {
  if (c.tipoDocumento === 'CONSUMIDOR_FINAL') return TIPOS_DOCUMENTO.CONSUMIDOR_FINAL;
  return `${c.tipoDocumento} ${c.tipoDocumento === 'CUIT' || c.tipoDocumento === 'CUIL' ? cuit(c.numeroDocumento) : c.numeroDocumento}`;
}

export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

export const ESTADOS_PROYECTO: Record<EstadoProyecto, Estado> = {
  EN_CURSO: { texto: 'En curso', tono: 'pendiente' },
  FINALIZADO: { texto: 'Finalizado', tono: 'ok' },
  CANCELADO: { texto: 'Cancelado', tono: 'info', tachado: true },
};

export const MODOS_IVA: Record<ModoIvaProyecto, string> = {
  MAS_IVA: 'Más IVA',
  ACORDADO_FINAL: 'Acordado final (IVA incluido)',
};

export const MODOS_IVA_AYUDA: Record<ModoIvaProyecto, string> = {
  MAS_IVA: 'Cada factura suma solo su IVA: el neto ya está en el acordado.',
  ACORDADO_FINAL: 'Las facturas no suman nada: el acordado es el precio final.',
};

export const ESTADOS_PRESUPUESTO: Record<EstadoPresupuesto, Estado> = {
  BORRADOR: { texto: 'Borrador', tono: 'info' },
  ENVIADO: { texto: 'Enviado', tono: 'pendiente' },
  ACEPTADO: { texto: 'Aceptado', tono: 'ok' },
  RECHAZADO: { texto: 'Rechazado', tono: 'error' },
  VENCIDO: { texto: 'Vencido', tono: 'info', tachado: true },
};

export const FORMAS_COTIZAR: Record<FormaCotizar, string> = {
  POR_ITEM: 'Por ítem',
  GLOBAL: 'Total global',
  SUPERFICIE: 'Por superficie',
};

export const IVA_PRESUPUESTO: Record<IvaPresupuesto, string> = {
  NO_INCLUYE: 'Aclarar que no incluye IVA',
  DISCRIMINADO: 'IVA discriminado y total con IVA',
  SIN_IVA: 'Sin mencionar el IVA',
};

/** "Plazo de obra: {valor}." con su valor. */
export function textoObservacion(o: { texto: string; valor?: string }): string {
  if (o.texto.includes('{valor}')) return o.texto.replace('{valor}', o.valor?.trim() || '…');
  return o.valor ? `${o.texto} ${o.valor}` : o.texto;
}
