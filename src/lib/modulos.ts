import { useAuth } from '@/auth/auth-context';

/** Módulos que se habilitan por empresa (espejo de shared/modulos del backend). */
export type Modulo =
  | 'comprobantes'
  | 'recibos'
  | 'recibos-pago'
  | 'cuenta-corriente'
  | 'proyectos'
  | 'presupuestos'
  | 'materiales'
  | 'importaciones'
  | 'integraciones'
  | 'webhooks';

/**
 * Qué módulos tiene la empresa y cómo llama a sus proyectos ("Obra" / "Obras"). Mientras el perfil
 * no trae la lista (sesiones viejas), se asume todo habilitado: el backend igual rechaza lo que no.
 */
export function useEmpresa() {
  const { tenant } = useAuth();
  const modulos = tenant?.modulos;
  const tiene = (m: Modulo) => !modulos || modulos.includes(m);
  const etiqueta = tenant?.etiquetaProyecto || 'Proyecto';
  const etiquetaPlural = tenant?.etiquetaProyectoPlural || 'Proyectos';
  return { tiene, etiqueta, etiquetaPlural, etiquetaMin: etiqueta.toLowerCase(), etiquetaPluralMin: etiquetaPlural.toLowerCase() };
}
