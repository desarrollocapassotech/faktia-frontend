import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Power, PowerOff } from 'lucide-react';
import { AlertaError, Aviso, Boton, BotonIcono, Campo, Cargando, ContenedorTabla, Entrada, Etiqueta, Selector, Tarjeta, Vacio } from '@/components/ui';
import { ambienteTexto } from '@/lib/formato';
import type { Ambiente, Emisor, PuntoVenta } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

export function PuntosVentaSeccion() {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const puntos = useQuery({ queryKey: ['puntos-venta'], queryFn: () => pedir<PuntoVenta[]>('/configuracion/puntos-venta') });
  const emisor = useQuery({ queryKey: ['emisor'], queryFn: () => pedir<Emisor>('/configuracion/emisor') });

  const cambiarActivo = useMutation({
    mutationFn: (pv: PuntoVenta) => pedir<PuntoVenta>(`/configuracion/puntos-venta/${pv.id}`, 'PATCH', { activo: !pv.activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['puntos-venta'] }),
  });

  if (puntos.error) return <AlertaError error={puntos.error} />;
  if (!puntos.data || !emisor.data) return <Cargando />;

  const ambiente = emisor.data.ambienteArca;
  const delAmbiente = puntos.data.filter((p) => p.ambiente === ambiente && p.activo);

  return (
    <div className="space-y-4">
      {delAmbiente.length === 0 && (
        <Aviso>
          No hay puntos de venta activos para {ambienteTexto(ambiente).toLowerCase()}. Sin uno no se puede emitir.
          {ambiente === 'HOMOLOGACION' && ' En pruebas, usá el número 1.'}
        </Aviso>
      )}
      <Tarjeta titulo="Puntos de venta">
        {puntos.data.length === 0 ? (
          <Vacio>Todavía no cargaste puntos de venta.</Vacio>
        ) : (
          <ContenedorTabla>
            <table className="fk-tabla">
              <thead>
                <tr>
                  <th className="fk-num">Número</th>
                  <th>Ambiente</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {puntos.data.map((pv) => (
                  <tr key={pv.id}>
                    <td className="fk-num">{String(pv.numero).padStart(5, '0')}</td>
                    <td>{ambienteTexto(pv.ambiente)}</td>
                    <td>{pv.descripcion ?? '—'}</td>
                    <td>
                      <Etiqueta tono={pv.activo ? 'ok' : 'info'}>{pv.activo ? 'Activo' : 'Inactivo'}</Etiqueta>
                    </td>
                    <td className="py-1">
                      <div className="flex justify-end gap-1">
                        <BotonIcono
                          etiqueta={pv.activo ? 'Desactivar punto de venta' : 'Activar punto de venta'}
                          icono={pv.activo ? PowerOff : Power}
                          peligro={pv.activo}
                          cargando={cambiarActivo.isPending && cambiarActivo.variables?.id === pv.id}
                          onClick={() => cambiarActivo.mutate(pv)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ContenedorTabla>
        )}
        <div className="mt-3">
          <AlertaError error={cambiarActivo.error} />
        </div>
      </Tarjeta>
      <NuevoPuntoVenta ambiente={ambiente} sugerirUno={ambiente === 'HOMOLOGACION' && puntos.data.length === 0} />
    </div>
  );
}

function NuevoPuntoVenta({ ambiente, sugerirUno }: { ambiente: Ambiente; sugerirUno: boolean }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState(sugerirUno ? '1' : '');
  const [amb, setAmb] = useState<Ambiente>(ambiente);
  const [descripcion, setDescripcion] = useState('');

  const crear = useMutation({
    mutationFn: () =>
      pedir<PuntoVenta>('/configuracion/puntos-venta', 'POST', {
        numero: Number(numero),
        ambiente: amb,
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      }),
    onSuccess: () => {
      setNumero('');
      setDescripcion('');
      void queryClient.invalidateQueries({ queryKey: ['puntos-venta'] });
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Tarjeta titulo="Agregar punto de venta">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Número" ayuda="Tiene que existir en ARCA como “RECE / Web Services”.">
            <Entrada type="number" min={1} max={99998} value={numero} onChange={(e) => setNumero(e.target.value)} required />
          </Campo>
          <Campo etiqueta="Ambiente">
            <Selector value={amb} onChange={(e) => setAmb(e.target.value as Ambiente)}>
              <option value="HOMOLOGACION">{ambienteTexto('HOMOLOGACION')}</option>
              <option value="PRODUCCION">{ambienteTexto('PRODUCCION')}</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Descripción" ayuda="Opcional.">
            <Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={100} />
          </Campo>
        </div>
        <AlertaError error={crear.error} />
        <div className="flex justify-end">
          <Boton type="submit" cargando={crear.isPending}>
            Agregar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
