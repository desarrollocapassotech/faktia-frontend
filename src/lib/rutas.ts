/** Staging de un lote importado. Vive bajo Comprobantes: se llega desde Nuevo comprobante → Factura masiva. */
export const rutaImportacion = (id: string) => `/comprobantes/importaciones/${id}`;

export const RUTA_CREACION_MASIVA = '/comprobantes/nuevo?tipo=factura&modo=masiva';

/** Recibos pasó a ser Nuevo comprobante → Recibo. */
export const RUTA_RECIBO = '/comprobantes/nuevo?tipo=recibo';
