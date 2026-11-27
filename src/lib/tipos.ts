// Tipos de la API del backend (Fase 2).

export type Ambiente = 'HOMOLOGACION' | 'PRODUCCION';
export type CondicionIva =
  | 'RESPONSABLE_INSCRIPTO'
  | 'EXENTO'
  | 'CONSUMIDOR_FINAL'
  | 'MONOTRIBUTO'
  | 'NO_CATEGORIZADO'
  | 'PROVEEDOR_EXTERIOR'
  | 'CLIENTE_EXTERIOR'
  | 'IVA_LIBERADO'
  | 'MONOTRIBUTO_SOCIAL'
  | 'NO_ALCANZADO'
  | 'MONOTRIBUTO_TIP';
export type TipoDocumento = 'CUIT' | 'CUIL' | 'DNI' | 'PASAPORTE' | 'CONSUMIDOR_FINAL';
export type TipoComprobante =
  | 'FACTURA_A'
  | 'NOTA_DEBITO_A'
  | 'NOTA_CREDITO_A'
  | 'FACTURA_B'
  | 'NOTA_DEBITO_B'
  | 'NOTA_CREDITO_B'
  | 'FACTURA_C'
  | 'NOTA_DEBITO_C'
  | 'NOTA_CREDITO_C';
export type Concepto = 'PRODUCTOS' | 'SERVICIOS' | 'PRODUCTOS_Y_SERVICIOS';
export type Moneda = 'ARS' | 'USD';
export type Unidad = 'HORA' | 'UNIDAD' | 'SERVICIO' | 'MES';
export type EstadoComprobante =
  | 'BORRADOR'
  | 'EMITIENDO'
  | 'PENDIENTE_VERIFICACION'
  | 'EMITIDO'
  | 'RECHAZADO'
  | 'ANULADO';

export type CampoArca = 'razonSocial' | 'condicionIva' | 'domicilioFiscal';

export interface Emisor {
  id: string;
  slug: string;
  nombreFantasia: string;
  /** Los datos fiscales llegan en null en una empresa recién registrada. */
  razonSocial: string | null;
  cuit: string | null;
  condicionIva: CondicionIva | null;
  domicilioFiscal: string | null;
  ingresosBrutos: string | null;
  inicioActividades: string | null;
  telefono: string | null;
  emailContacto: string | null;
  ambienteArca: Ambiente;
  /** Razón social, CUIT, condición IVA y domicilio cargados: sin esto no se puede facturar. */
  datosFiscalesCompletos: boolean;
  /** Campos que salieron del padrón de ARCA: no se editan. */
  camposDeArca: CampoArca[];
  /** Solo en GET /configuracion/emisor: si el servidor puede validar el CUIT en el padrón real de ARCA. */
  padronDisponible?: boolean;
}

export interface EstadoArca {
  ambiente: Ambiente;
  afipSdkConfigurado: boolean;
  usaCuitPrueba: boolean;
  cuitEmision: string;
  certificado: Certificado | null;
}

export interface PuntoVenta {
  id: string;
  numero: number;
  ambiente: Ambiente;
  descripcion: string | null;
  activo: boolean;
}

export interface Certificado {
  id: string;
  ambiente: Ambiente;
  alias: string | null;
  huellaSha256: string;
  venceEl: string;
  createdAt: string;
}

export interface PlantillaPdf {
  colorPrimario: string;
  colorSecundario: string;
  textoPie: string | null;
  firmaTexto: string | null;
  mostrarDuplicado: boolean;
  tieneLogo: boolean;
  logoMime: string | null;
}

export interface Cliente {
  id: string;
  razonSocial: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  condicionIva: CondicionIva;
  domicilio: string | null;
  email: string | null;
  pais: string;
  monedaPreferida: Moneda;
  diasVencimiento: number | null;
  activo: boolean;
}

export interface Linea {
  descripcion: string;
  cantidad: string;
  unidad: Unidad;
  precioUnitario: string;
  bonificacionPct: string;
  alicuotaIva: string;
}

export interface LineaGuardada extends Linea {
  id: string;
  orden: number;
  importeNeto: string;
  importeIva: string;
  importeTotal: string;
}

export interface ComprobanteResumen {
  id: string;
  tipo: TipoComprobante;
  estado: EstadoComprobante;
  ambiente: Ambiente;
  numero: number | null;
  fechaEmision: string;
  moneda: Moneda;
  importeTotal: string;
  cae: string | null;
  errorMensaje: string | null;
  createdAt: string;
  cliente: { id: string; razonSocial: string };
  puntoVenta: { numero: number };
}

/**
 * Fila del listado de comprobantes (`/comprobantes?incluirRecibos=true`): comprobantes de ARCA y
 * recibos guardados. Los recibos no tienen punto de venta, CAE ni ambiente; su número es texto.
 */
export type FilaComprobantes =
  | (ComprobanteResumen & { clase: 'comprobante'; numeroTexto: null })
  | (Omit<ComprobanteResumen, 'tipo' | 'ambiente' | 'puntoVenta' | 'cliente'> & {
      clase: 'recibo';
      tipo: 'RECIBO_COBRO' | 'RECIBO_PAGO';
      ambiente: null;
      puntoVenta: null;
      numeroTexto: string | null;
      cliente: { id: string | null; razonSocial: string };
    });

/** Recibo guardado (`GET /recibos/:id`). Los importes vienen como string decimal ("1234.50"). */
export interface Recibo {
  id: string;
  tipo: 'COBRO' | 'PAGO';
  numero: string | null;
  fecha: string;
  moneda: Moneda;
  total: string;
  clienteId: string | null;
  contraparteNombre: string;
  contraparte: { nombre: string; documento?: string; domicilio?: string };
  items: Array<{ descripcion: string; cantidad?: string; importe: string }>;
  comprobantesAplicados: Array<{ descripcion: string; importe: string; comprobanteId?: string }> | null;
  periodo: string | null;
  medioPago: string | null;
  observaciones: string | null;
  proyectoId?: string | null;
  anuladoEn?: string | null;
  motivoAnulacion?: string | null;
  createdAt: string;
}

export interface Comprobante {
  id: string;
  tipo: TipoComprobante;
  estado: EstadoComprobante;
  ambiente: Ambiente;
  version: number;
  clienteId: string;
  puntoVentaId: string;
  numero: number | null;
  numeroReservado: number | null;
  fechaEmision: string;
  concepto: Concepto;
  fechaServicioDesde: string | null;
  fechaServicioHasta: string | null;
  fechaVtoPago: string | null;
  moneda: Moneda;
  cotizacion: string;
  cancelaMismaMoneda: boolean;
  importeNetoGravado: string;
  importeIva: string;
  importeTributos: string;
  importeTotal: string;
  observaciones: string | null;
  proyectoId?: string | null;
  motivo: string | null;
  cae: string | null;
  caeVencimiento: string | null;
  errorMensaje: string | null;
  errorDetalle: string | null;
  emitidoEn: string | null;
  lineas: LineaGuardada[];
  alicuotas: Array<{ arcaId: number; baseImponible: string; importe: string }>;
  cliente: Cliente;
  puntoVenta: PuntoVenta;
  asociado: { id: string; tipo: TipoComprobante; numero: number | null; puntoVenta: { numero: number } } | null;
  asociadosDesde: Array<{ id: string; tipo: TipoComprobante; numero: number | null; estado: EstadoComprobante; importeTotal: string }>;
  letraSugerida: 'A' | 'B' | 'C';
  advertenciaLetra: string | null;
}

// ── Fase 4: integraciones e importaciones ─────────────────────────────────

export type OrigenItem = 'TRACKER' | 'API' | 'EXCEL' | 'MANUAL';
export type Scope = 'items:write' | 'comprobantes:write' | 'comprobantes:read' | 'acceso:emitir';
export type EstadoItem = 'VALIDO' | 'CON_ERRORES' | 'DUPLICADO' | 'EN_BORRADOR' | 'FACTURADO' | 'DESCARTADO';
export type EstadoImportacion = 'EN_STAGING' | 'CONFIRMADA' | 'DESCARTADA' | 'FALLIDA';

export interface Integracion {
  id: string;
  nombre: string;
  origen: OrigenItem;
  keyPrefijo: string;
  scopes: Scope[];
  ultimoUsoEn: string | null;
  revocadaEn: string | null;
  createdAt: string;
}

export interface Tarifa {
  id: string;
  clienteId: string;
  cliente: { id: string; razonSocial: string };
  origen: OrigenItem | null;
  claveExterna: string | null;
  descripcion: string | null;
  unidad: Unidad;
  precioUnitario: string;
  moneda: Moneda;
  alicuotaIva: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

export type CampoMapeo =
  | 'referenciaExterna'
  | 'descripcion'
  | 'cantidad'
  | 'unidad'
  | 'precioUnitario'
  | 'moneda'
  | 'alicuotaIva'
  | 'fecha'
  | 'periodo.desde'
  | 'periodo.hasta'
  | 'cliente.numeroDocumento'
  | 'cliente.tipoDocumento'
  | 'cliente.referenciaExterna'
  | 'cliente.razonSocial'
  | `metadatos.${string}`;

export interface ColumnaMapeo {
  campo: CampoMapeo;
  encabezado: string;
  alias?: string[];
  tipo: 'texto' | 'numero' | 'fecha' | 'decimal';
  formatoFecha?: string;
  separadorDecimal?: ',' | '.';
}

export interface PlantillaMapeoConfig {
  hoja?: string | number;
  filaEncabezado: number;
  delimitador?: ',' | ';' | '\t';
  encoding?: 'utf-8' | 'latin1';
  columnas: ColumnaMapeo[];
  valoresPorDefecto?: { unidad?: Unidad; alicuotaIva?: string; moneda?: Moneda };
  referencia?: { columnas: string[] };
}

export interface PlantillaMapeo {
  id: string;
  nombre: string;
  formato: 'xlsx' | 'csv';
  config: PlantillaMapeoConfig;
  activa: boolean;
}

export interface Advertencia {
  referencia?: string;
  mensaje: string;
}

export interface Importacion {
  id: string;
  origen: OrigenItem;
  estado: EstadoImportacion;
  descripcion: string | null;
  parametros: Record<string, unknown> | null;
  advertencias: Advertencia[] | null;
  totalItems: number;
  validos: number;
  conErrores: number;
  duplicados: number;
  actualizados: number;
  createdAt: string;
  confirmadaEn: string | null;
  estadosItems?: Partial<Record<EstadoItem, number>>;
}

export interface ItemFacturable {
  id: string;
  importacionId: string | null;
  origen: OrigenItem;
  referenciaExterna: string;
  clienteId: string | null;
  cliente: { id: string; razonSocial: string } | null;
  clienteTipoDocumento: TipoDocumento | null;
  clienteNumeroDocumento: string | null;
  clienteReferenciaExterna: string | null;
  clienteAlta: { razonSocial: string; condicionIva?: string; domicilio?: string; email?: string } | null;
  descripcion: string;
  cantidad: string;
  unidad: Unidad;
  precioUnitario: string;
  moneda: Moneda;
  alicuotaIva: string;
  fecha: string | null;
  periodoDesde: string | null;
  periodoHasta: string | null;
  metadatos: {
    precioDeTarifa?: boolean;
    tarifaId?: string | null;
    valoresOriginales?: Record<string, string>;
    fila?: number;
    [clave: string]: unknown;
  } | null;
  estado: EstadoItem;
  errores: Array<{ campo: string; mensaje: string }> | null;
  comprobanteId: string | null;
}

export interface Paginado<T> {
  total: number;
  pagina: number;
  porPagina: number;
  items: T[];
}

// ── Cuenta corriente ─────────────────────────────────────────────────────────
// Importes como string decimal ("1234.50"); fechas "YYYY-MM-DD". DEBE suma al saldo (lo que el
// cliente debe) y HABER resta (cobros, notas de crédito, ajustes a su favor).

export type TipoMovimientoCc = 'DEBE' | 'HABER';
export type OrigenMovimientoCc = 'COMPROBANTE' | 'RECIBO' | 'MANUAL' | 'ACUERDO' | 'ANULACION';
export type EstadoMovimientoCc = 'PENDIENTE' | 'PARCIAL' | 'CANCELADO';

export interface SaldoCc {
  moneda: Moneda;
  saldo: string;
  /** Sin lo que falta certificar de sus proyectos. */
  exigible?: string;
}

export interface TotalCc {
  moneda: Moneda;
  total: string;
}

/** Fila del listado de cuentas (`GET /cuenta-corriente/cuentas`). */
export interface CuentaCc {
  clienteId: string;
  razonSocial: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  activo: boolean;
  tieneMovimientos: boolean;
  saldos: SaldoCc[];
  comprobantesPendientes: number;
  proximoVencimiento: string | null;
  vencido: boolean;
}

/** Comprobante con saldo pendiente en el resumen (vencidos y próximos a vencer). */
export interface PendienteCc {
  id: string;
  clienteId: string;
  razonSocial: string;
  proyectoId?: string | null;
  proyecto?: string | null;
  certificacionId?: string | null;
  concepto: string;
  numero: string | null;
  moneda: Moneda;
  importe: string;
  pendiente: string;
  fecha: string;
  fechaVencimiento: string;
}

export interface ResumenCc {
  diasProximos: number;
  porCobrar: TotalCc[];
  vencido: TotalCc[];
  proximo: TotalCc[];
  /** Lo que falta certificar de los proyectos: está en "por cobrar", pero no vence. */
  aCertificar?: TotalCc[];
  vencidos: PendienteCc[];
  proximos: PendienteCc[];
}

/** El otro lado de una imputación: el cobro (en un DEBE) o la factura (en un HABER). */
export interface ImputacionCc {
  id: string;
  importe: string;
  automatica: boolean;
  movimiento: { id: string; concepto: string; numero: string | null; fecha: string; comprobanteId: string | null; reciboId: string | null };
}

export interface MovimientoCc {
  id: string;
  tipo: TipoMovimientoCc;
  origen: OrigenMovimientoCc;
  concepto: string;
  numero: string | null;
  comprobanteId: string | null;
  reciboId: string | null;
  moneda: Moneda;
  importe: string;
  fecha: string;
  fechaVencimiento: string | null;
  vencido: boolean;
  observaciones: string | null;
  /** DEBE: lo que falta cobrar. HABER: lo que queda sin imputar (a cuenta). */
  pendiente: string;
  estado: EstadoMovimientoCc;
  /** Saldo de su moneda después de este movimiento. */
  saldo: string;
  imputaciones: ImputacionCc[];
  proyecto?: { id: string; nombre: string } | null;
  porCertificacion?: boolean;
  aCertificar?: string | null;
  monedaOrigen?: Moneda | null;
  importeOrigen?: string | null;
  tipoCambio?: string | null;
  anulado?: boolean;
  createdAt: string;
}

/** `GET /cuenta-corriente/cuentas/:clienteId`. Movimientos del más nuevo al más viejo. */
export interface CuentaClienteCc {
  cliente: Pick<Cliente, 'id' | 'razonSocial' | 'tipoDocumento' | 'numeroDocumento' | 'condicionIva' | 'activo' | 'diasVencimiento' | 'monedaPreferida'>;
  saldos: SaldoCc[];
  movimientos: MovimientoCc[];
}

export interface PreferenciasEmpresa {
  modulos: string[];
  etiquetaProyecto: string;
  etiquetaProyectoPlural: string;
  avisosEmail: boolean;
  diasAvisoVencimiento: number;
  diasValidezPresupuesto: number;
}

export interface ItemAviso {
  cliente: string;
  proyecto: string | null;
  concepto: string;
  numero: string | null;
  moneda: Moneda;
  pendiente: string;
  fechaVencimiento: string;
}

export interface VistaPreviaAviso {
  dias: number;
  vencidos: ItemAviso[];
  proximos: ItemAviso[];
}

export interface HistorialAvisos {
  transporte: 'smtp' | 'log';
  envios: Array<{ fecha: string; destinatarios: string[]; vencidos: number; proximos: number; transporte: string }>;
}

// ─────────────────────────────── Proyectos ───────────────────────────────

export type EstadoProyecto = 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';
export type ModoIvaProyecto = 'MAS_IVA' | 'ACORDADO_FINAL';

export interface SaldosProyecto {
  montoAcordado: string | null;
  adicionales: string;
  totalEntregado: string;
  saldo: string;
  saldoExigible: string;
  aCertificar: string;
  vencido: string;
}

export interface ProyectoResumen {
  id: string;
  clienteId: string;
  nombre: string;
  ubicacion: string | null;
  estado: EstadoProyecto;
  moneda: Moneda;
  montoAcordado: string | null;
  modoIva: ModoIvaProyecto;
  tipoCambioFijo: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  observaciones: string | null;
  cliente: { id: string; razonSocial: string };
  saldos: SaldosProyecto;
}

export interface CertificacionProyecto {
  id: string;
  fecha: string;
  descripcion: string;
  importe: string;
  fechaVencimiento: string | null;
  pendiente: string;
  vencido: boolean;
}

export interface HitoProyecto {
  id: string;
  orden: number;
  descripcion: string;
  importe: string;
  fechaVencimiento: string | null;
  porCertificacion: boolean;
  cobrado: string;
  pendiente: string;
  exigible: string;
  certificado: string;
  aCertificar: string;
  vencido: boolean;
  /** Sin cobros ni certificaciones: se puede cambiar el importe o quitar. */
  editable: boolean;
  certificaciones: CertificacionProyecto[];
}

export interface CargoProyecto {
  id: string;
  origen: OrigenMovimientoCc;
  concepto: string;
  numero: string | null;
  comprobanteId: string | null;
  fecha: string;
  fechaVencimiento: string | null;
  importe: string;
  pendiente: string;
  observaciones: string | null;
  vencido: boolean;
}

export interface EntregaProyecto {
  id: string;
  origen: OrigenMovimientoCc;
  reciboId: string | null;
  concepto: string;
  numero: string | null;
  fecha: string;
  importe: string;
  monedaOrigen: Moneda | null;
  importeOrigen: string | null;
  tipoCambio: string | null;
  observaciones: string | null;
  anulado: boolean;
  aCuenta: string;
}

export interface ProyectoDetalle extends Omit<ProyectoResumen, 'cliente'> {
  cliente: { id: string; razonSocial: string; tipoDocumento: TipoDocumento; numeroDocumento: string };
  hitos: HitoProyecto[];
  cargos: CargoProyecto[];
  entregas: EntregaProyecto[];
  notasCredito: Array<{ id: string; concepto: string; numero: string | null; comprobanteId: string | null; fecha: string; importe: string }>;
  recibos: Array<{ id: string; numero: string | null; fecha: string; moneda: Moneda; total: string; anulado: boolean; medioPago: string | null }>;
}

// ─────────────────────────────── Presupuestos ───────────────────────────────

export type EstadoPresupuesto = 'BORRADOR' | 'ENVIADO' | 'ACEPTADO' | 'RECHAZADO' | 'VENCIDO';
export type FormaCotizar = 'POR_ITEM' | 'GLOBAL' | 'SUPERFICIE';
export type IvaPresupuesto = 'SIN_IVA' | 'NO_INCLUYE' | 'DISCRIMINADO';

export interface Superficie {
  ancho?: string | null;
  largo?: string | null;
  alturaLateral?: string | null;
  alturaCumbrera?: string | null;
  metrosCuadrados?: string | null;
  precioMetroCuadrado?: string | null;
}

export interface PresupuestoResumen {
  id: string;
  numero: string;
  fecha: string;
  fechaVencimiento: string;
  estado: EstadoPresupuesto;
  titulo: string | null;
  lugar: string | null;
  moneda: Moneda;
  total: string;
  cliente: { id: string; razonSocial: string };
  proyectoId: string | null;
}

export interface Presupuesto {
  id: string;
  numero: string;
  fecha: string;
  fechaVencimiento: string;
  estado: EstadoPresupuesto;
  clienteId: string;
  titulo: string | null;
  lugar: string | null;
  moneda: Moneda;
  formaCotizar: FormaCotizar;
  superficie: Superficie | null;
  importeGlobal: string | null;
  ivaModo: IvaPresupuesto;
  alicuotaIva: string;
  subtotal: string;
  iva: string;
  total: string;
  observaciones: Array<{ texto: string; valor?: string }>;
  notas: string | null;
  cliente: { razonSocial: string; documento: string | null; domicilio: string | null };
  proyectoId: string | null;
  duplicadoDeId: string | null;
  editable: boolean;
  items: Array<{ id: string; orden: number; cantidad: string | null; descripcion: string; importe: string | null }>;
}

export interface ItemBiblioteca {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string | null;
  activo: boolean;
}

export interface ObservacionCatalogo {
  id: string;
  texto: string;
  llevaValor: boolean;
  valorSugerido: string | null;
  porDefecto: boolean;
  orden: number;
  activo: boolean;
}
