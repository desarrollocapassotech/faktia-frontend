import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/auth-context';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Tarjeta } from '@/components/ui';
import type { PreferenciasEmpresa } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

const NOMBRE_MODULO: Record<string, string> = {
  comprobantes: 'Facturación electrónica',
  recibos: 'Recibos de cobro',
  'recibos-pago': 'Recibos de pago',
  'cuenta-corriente': 'Cuenta corriente',
  proyectos: 'Proyectos',
  presupuestos: 'Presupuestos',
  materiales: 'Materiales y proveedores',
  importaciones: 'Importaciones',
  integraciones: 'Integraciones y API',
  webhooks: 'Webhooks',
};

/** Cómo se llaman los proyectos en la empresa y qué módulos tiene habilitados (eso lo cambia Faktia). */
export function PreferenciasSeccion() {
  const { pedir } = useApi();
  const { data, error } = useQuery({ queryKey: ['preferencias'], queryFn: () => pedir<PreferenciasEmpresa>('/configuracion/preferencias') });
  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <FormularioEtiquetas key={`${data.etiquetaProyecto}|${data.etiquetaProyectoPlural}`} preferencias={data} />
      <Tarjeta titulo="Módulos habilitados">
        <p className="mb-3 text-sm text-fk-gris-texto">Para sumar o quitar un módulo, escribinos.</p>
        <div className="flex flex-wrap gap-2">
          {data.modulos.map((m) => (
            <Etiqueta key={m} tono="ok">
              {NOMBRE_MODULO[m] ?? m}
            </Etiqueta>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

function FormularioEtiquetas({ preferencias }: { preferencias: PreferenciasEmpresa }) {
  const { pedir } = useApi();
  const { refrescarPerfil } = useAuth();
  const [singular, setSingular] = useState(preferencias.etiquetaProyecto);
  const [plural, setPlural] = useState(preferencias.etiquetaProyectoPlural);
  const [guardado, setGuardado] = useState(false);
  const guardar = useMutation({
    mutationFn: () =>
      pedir<PreferenciasEmpresa>('/configuracion/preferencias', 'PATCH', { etiquetaProyecto: singular.trim(), etiquetaProyectoPlural: plural.trim() }),
    onSuccess: async () => {
      setGuardado(true);
      // El menú toma la etiqueta del perfil de la sesión.
      await refrescarPerfil();
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Tarjeta titulo="Nombre de los proyectos">
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-fk-gris-texto">Cómo aparecen en el menú, las pantallas y los documentos. Por ejemplo: Obra y Obras.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Singular">
            <Entrada
              value={singular}
              onChange={(e) => {
                setSingular(e.target.value);
                setGuardado(false);
              }}
              maxLength={40}
              required
            />
          </Campo>
          <Campo etiqueta="Plural">
            <Entrada
              value={plural}
              onChange={(e) => {
                setPlural(e.target.value);
                setGuardado(false);
              }}
              maxLength={40}
              required
            />
          </Campo>
        </div>
        <AlertaError error={guardar.error} />
        {guardado && <Aviso tono="verde">Guardado.</Aviso>}
        <div className="flex justify-end">
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
