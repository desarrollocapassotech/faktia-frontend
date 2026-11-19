/** Staging de un lote importado. Vive bajo Comprobantes: se llega desde Nueva factura → Crear de forma masiva. */
export const rutaImportacion = (id: string) => `/comprobantes/importaciones/${id}`;

export const RUTA_CREACION_MASIVA = '/comprobantes/nuevo?modo=masiva';
