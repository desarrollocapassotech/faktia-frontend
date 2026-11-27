import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Wallet } from 'lucide-react';
import { claseBoton } from '@/components/estilos';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertaError, Boton, Cargando, ContenedorTabla, EncabezadoPagina, Etiqueta, EtiquetaEstado, EtiquetaPrueba, Tarjeta, Vacio } from '@/components/ui';
import { CONDICIONES_IVA, dinero, documentoCliente, ESTADOS, ESTADOS_PRESUPUESTO, ESTADOS_PROYECTO, fecha, numeroComprobante, tipoLargo } from '@/lib/formato';
import { useEmpresa } from '@/lib/modulos';
import type { Cliente, FilaComprobantes, Paginado, PresupuestoResumen, ProyectoResumen } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

const ULTIMOS = 10;
const TIPOS_RECIBO = { RECIBO_COBRO: 'Recibo de cobro', RECIBO_PAGO: 'Recibo de pago' } as const;

/** Detalle de un cliente: sus datos y sus últimos comprobantes (facturas, notas y recibos). */
export function ClienteDetallePage() {
  const { id = '' } = useParams();
  const { pedir } = useApi();
  const navigate = useNavigate();

  const { data: c, error } = useQuery({ queryKey: ['cliente', id], queryFn: () => pedir<Cliente>(`/clientes/${id}`) });
  const comprobantes = useQuery({
    queryKey: ['comprobantes', { clienteId: id, ultimos: ULTIMOS }],
    queryFn: () => pedir<Paginado<FilaComprobantes>>(`/comprobantes?clienteId=${encodeURIComponent(id)}&porPagina=${ULTIMOS}&incluirRecibos=true`),
  });

  if (error) return <AlertaError error={error} />;
  if (!c) return <Cargando />;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={c.razonSocial}
        tituloEnBarra
        migas={[{ texto: 'Clientes', a: '/clientes' }, { texto: c.razonSocial }]}
        junto={!c.activo && <Etiqueta>Inactivo</Etiqueta>}
      />

      <Tarjeta
        titulo="Datos"
        acciones={
          <div className="flex flex-wrap gap-2">
            <Boton variante="terciario" onClick={() => navigate(`/cuenta-corriente/${c.id}`)}>
              <Wallet className="h-4 w-4" strokeWidth={2} aria-hidden />
              Cuenta corriente
            </Boton>
            <Boton variante="terciario" onClick={() => navigate(`/clientes/${c.id}/editar`)}>
              <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
              Editar
            </Boton>
          </div>
        }
      >
        <dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato titulo="Razón social" valor={c.razonSocial} />
          <Dato titulo="Documento" valor={<span className="tabular-nums">{documentoCliente(c)}</span>} />
          <Dato titulo="Condición IVA" valor={CONDICIONES_IVA[c.condicionIva]} />
          <Dato titulo="Moneda habitual" valor={c.monedaPreferida === 'USD' ? 'Dólares' : 'Pesos'} />
          <Dato titulo="Domicilio" valor={c.domicilio || '—'} />
          <Dato titulo="Email" valor={c.email || '—'} />
          <Dato titulo="Días para el vencimiento" valor={c.diasVencimiento != null ? String(c.diasVencimiento) : '—'} />
          <Dato titulo="Estado" valor={c.activo ? 'Activo' : 'Inactivo (no aparece al facturar)'} />
        </dl>
      </Tarjeta>

      <ObrasYPresupuestos clienteId={c.id} />

      <Tarjeta
        titulo="Últimos comprobantes"
        acciones={
          <Boton onClick={() => navigate('/comprobantes/nuevo')}>
            <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            Nuevo comprobante
          </Boton>
        }
      >
        {comprobantes.error ? (
          <AlertaError error={comprobantes.error} />
        ) : !comprobantes.data ? (
          <Cargando />
        ) : comprobantes.data.items.length === 0 ? (
          <Vacio>Todavía no hay comprobantes para este cliente.</Vacio>
        ) : (
          <>
            <ContenedorTabla>
              <table className="fk-tabla">
                <thead>
                  <tr>
                    <th>Comprobante</th>
                    <th className="fk-num">Número</th>
                    <th>Fecha</th>
                    <th className="fk-num">Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {comprobantes.data.items.map((f) => (
                    <tr key={f.id}>
                      <td className="whitespace-nowrap">
                        <Link
                          to={f.clase === 'recibo' ? `/comprobantes/recibos/${f.id}` : `/comprobantes/${f.id}`}
                          className="font-medium text-fk-fiordo underline-offset-2 hover:underline"
                        >
                          {f.clase === 'recibo' ? TIPOS_RECIBO[f.tipo] : tipoLargo(f.tipo)}
                        </Link>
                      </td>
                      <td className="fk-num">{f.clase === 'recibo' ? (f.numeroTexto ?? '—') : numeroComprobante(f.puntoVenta.numero, f.numero)}</td>
                      <td className="whitespace-nowrap tabular-nums">{fecha(f.fechaEmision)}</td>
                      <td className="fk-num">{dinero(f.importeTotal, f.moneda)}</td>
                      <td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <EtiquetaEstado estado={ESTADOS[f.estado]} />
                          <EtiquetaPrueba ambiente={f.ambiente ?? ''} soloIcono />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ContenedorTabla>
            {comprobantes.data.total > ULTIMOS && (
              <p className="mt-4 text-sm text-fk-gris-texto">
                Se muestran los {ULTIMOS} más recientes de {comprobantes.data.total}. Para ver todos, filtrá por este cliente en{' '}
                <Link to="/comprobantes" className="font-medium text-fk-fiordo underline underline-offset-2">
                  Comprobantes
                </Link>
                .
              </p>
            )}
          </>
        )}
      </Tarjeta>
    </div>
  );
}

/** Obras (proyectos) y presupuestos del cliente, según los módulos de la empresa. */
function ObrasYPresupuestos({ clienteId }: { clienteId: string }) {
  const { pedir } = useApi();
  const { tiene, etiqueta, etiquetaPlural, etiquetaMin } = useEmpresa();
  const conProyectos = tiene('proyectos');
  const conPresupuestos = tiene('presupuestos');
  const proyectos = useQuery({
    queryKey: ['proyectos', `clienteId=${clienteId}`],
    queryFn: () => pedir<ProyectoResumen[]>(`/proyectos?clienteId=${encodeURIComponent(clienteId)}`),
    enabled: conProyectos,
  });
  const presupuestos = useQuery({
    queryKey: ['presupuestos', `clienteId=${clienteId}`],
    queryFn: () => pedir<PresupuestoResumen[]>(`/presupuestos?clienteId=${encodeURIComponent(clienteId)}`),
    enabled: conPresupuestos,
  });
  if (!conProyectos && !conPresupuestos) return null;
  return (
    <div className={`grid gap-6 ${conProyectos && conPresupuestos ? 'xl:grid-cols-2' : ''} xl:items-start`}>
      {conProyectos && (
        <Tarjeta
          titulo={etiquetaPlural}
          acciones={
            <Link to={`/proyectos/nuevo?cliente=${clienteId}`} className={claseBoton('terciario')}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Nueva {etiquetaMin}
            </Link>
          }
        >
          {proyectos.error ? (
            <AlertaError error={proyectos.error} />
          ) : !proyectos.data ? (
            <Cargando />
          ) : proyectos.data.length === 0 ? (
            <Vacio>Todavía no tiene {etiquetaPlural.toLowerCase()}.</Vacio>
          ) : (
            <ContenedorTabla>
              <table className="fk-tabla">
                <thead>
                  <tr>
                    <th>{etiqueta}</th>
                    <th>Estado</th>
                    <th className="fk-num">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {proyectos.data.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/proyectos/${p.id}`} className="font-medium text-fk-fiordo underline-offset-2 hover:underline">
                          {p.nombre}
                        </Link>
                        {p.ubicacion && <span className="block text-xs text-fk-gris-texto">{p.ubicacion}</span>}
                      </td>
                      <td>
                        <EtiquetaEstado estado={ESTADOS_PROYECTO[p.estado]} />
                      </td>
                      <td className="fk-num">{dinero(p.saldos.saldo, p.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ContenedorTabla>
          )}
        </Tarjeta>
      )}
      {conPresupuestos && (
        <Tarjeta
          titulo="Presupuestos"
          acciones={
            <Link to={`/presupuestos/nuevo?cliente=${clienteId}`} className={claseBoton('terciario')}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Nuevo presupuesto
            </Link>
          }
        >
          {presupuestos.error ? (
            <AlertaError error={presupuestos.error} />
          ) : !presupuestos.data ? (
            <Cargando />
          ) : presupuestos.data.length === 0 ? (
            <Vacio>Todavía no tiene presupuestos.</Vacio>
          ) : (
            <ContenedorTabla>
              <table className="fk-tabla">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Trabajo</th>
                    <th>Estado</th>
                    <th className="fk-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuestos.data.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap tabular-nums">
                        <Link to={`/presupuestos/${p.id}`} className="font-medium text-fk-fiordo underline-offset-2 hover:underline">
                          {p.numero}
                        </Link>
                        <span className="block text-xs text-fk-gris-texto">{fecha(p.fecha)}</span>
                      </td>
                      <td>{p.titulo ?? p.lugar ?? '—'}</td>
                      <td>
                        <EtiquetaEstado estado={ESTADOS_PRESUPUESTO[p.estado]} />
                      </td>
                      <td className="fk-num">{dinero(p.total, p.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ContenedorTabla>
          )}
        </Tarjeta>
      )}
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="fk-etiqueta">{titulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
