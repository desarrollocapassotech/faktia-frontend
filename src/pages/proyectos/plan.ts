// Plan de pagos de un proyecto: hitos editables y lo que se manda al backend.

export interface HitoEditable {
  /** Hito guardado; sin id, es nuevo. */
  id?: string;
  clave: string;
  descripcion: string;
  importe: string;
  fechaVencimiento: string;
  porCertificacion: boolean;
  /** Con cobros o certificaciones: solo cambian descripción y vencimiento. */
  bloqueado?: boolean;
}

let contador = 0;
export const nuevoHito = (descripcion = '', importe = ''): HitoEditable => ({
  clave: `h${++contador}`,
  descripcion,
  importe,
  fechaVencimiento: '',
  porCertificacion: false,
});

export function sumaHitos(hitos: HitoEditable[]): number {
  return hitos.reduce((s, h) => s + (Number(h.importe) || 0), 0);
}

/** Lo que se manda al backend (PUT /proyectos/:id/plan o el alta). */
export function hitosParaEnviar(hitos: HitoEditable[]) {
  return hitos
    .filter((h) => h.descripcion.trim() || Number(h.importe))
    .map((h) => ({
      ...(h.id ? { id: h.id } : {}),
      descripcion: h.descripcion.trim(),
      importe: Number(h.importe).toFixed(2),
      fechaVencimiento: h.fechaVencimiento || null,
      porCertificacion: h.porCertificacion,
    }));
}
