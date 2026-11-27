import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, HandCoins, Link2, ListTree, ListFilter, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';
import {
  AlertaError,
  Boton,
  BotonIcono,
  Cargando,
  ContenedorTabla,
  EncabezadoPagina,
  Etiqueta,
  EtiquetaEstado,
  Selector,
  Tarjeta,
  Vacio,
} from '@/components/ui';
import { dinero, documentoCliente, ESTADOS_CC, fecha, VENCIDO } from '@/lib/formato';
import type { CuentaClienteCc, Moneda, MovimientoCc } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { Indicador } from './CuentaCorrientePage';
import { EliminarMovimientoModal, ImputacionesModal, ImputarModal, MovimientoModal, VencimientoModal } from './modalesCuenta';

type Filtro = 'todos' | 'pendientes' | 'a-cuenta';

const FILTROS: Array<{ id: Filtro; texto: string; icono: LucideIcon }> = [
  { id: 'todos', texto: 'Todos', icono: ListFilter },
  { id: 'pendientes', texto: 'Sin cobrar', icono: CalendarClock },
  { id: 'a-cuenta', texto: 'Cobros a cuenta', icono: HandCoins },
];

type ModalCuenta =
  | { tipo: 'nuevo' }
  | { tipo: 'editar' | 'imputar' | 'imputaciones' | 'vencimiento' | 'eliminar'; movimiento: MovimientoCc }
  | null;

/** Link al comprobante o recibo del que sale el movimiento (los manuales no tienen). */
function rutaOrigen(m: { comprobanteId: string | null; reciboId: string | null }): string | null {
  if (m.comprobanteId) return `/comprobantes/${m.comprobanteId}`;
  if (m.reciboId) return `/comprobantes/recibos/${m.reciboId}`;
  return null;
}

/** La cuenta de un cliente: saldo por moneda y el estado de cuenta con debe, haber, pendiente e imputaciones. */
export function CuentaClientePage() {
  const { clienteId = '' } = useParams();
  const { pedir } = useApi();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [moneda, setMoneda] = useState<Moneda | ''>('');
  const [modal, setModal] = useState<ModalCuenta>(null);

  const { data, error } = useQuery({
    queryKey: ['cuenta-corriente', 'cuenta', clienteId],
    queryFn: () => pedir<CuentaClienteCc>(`/cuenta-corriente/cuentas/${encodeURIComponent(clienteId)}`),
  });

  const monedas = useMemo(() => [...new Set((data?.movimientos ?? []).map((m) => m.moneda))], [data]);
  const visibles = useMemo(
    () =>
      (data?.movimientos ?? []).filter((m) => {
        if (moneda && m.moneda !== moneda) return false;
        if (filtro === 'pendientes') return m.tipo === 'DEBE' && Number(m.pendiente) > 0;
        if (filtro === 'a-cuenta') return m.tipo === 'HABER' && Number(m.pendiente) > 0;
        return true;
      }),
    [data, filtro, moneda],
  );
  const pendientesDebe = useMemo(
    () => (data?.movimientos ?? []).filter((m) => m.tipo === 'DEBE' && Number(m.pendiente) > 0).reverse(),
    [data],
  );

  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  const { cliente } = data;
  const saldos = data.saldos.length ? data.saldos : [{ moneda: cliente.monedaPreferida, saldo: '0' }];

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={cliente.razonSocial}
        tituloEnBarra
        migas={[{ texto: 'Cuenta corriente', a: '/cuenta-corriente' }, { texto: cliente.razonSocial }]}
        junto={!cliente.activo && <Etiqueta>Inactivo</Etiqueta>}
        acciones={
          <>
            <Boton variante="terciario" onClick={() => setModal({ tipo: 'nuevo' })}>
              <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              Movimiento manual
            </Boton>
            <Boton onClick={() => navigate(`/comprobantes/nuevo?tipo=recibo&modo=cobro&cliente=${encodeURIComponent(cliente.id)}&volver=cuenta`)}>
              <HandCoins className="h-4 w-4" strokeWidth={2} aria-hidden />
              Registrar cobro
            </Boton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {saldos.map((s) => {
          const n = Number(s.saldo);
          return (
            <Indicador
              key={s.moneda}
              titulo={`Saldo en ${s.moneda === 'ARS' ? 'pesos' : 'dólares'}`}
              valor={dinero(Math.abs(n), s.moneda)}
              ayuda={
                s.exigible !== undefined && s.exigible !== s.saldo
                  ? `Exigible hoy: ${dinero(s.exigible, s.moneda)} (el resto falta certificar).`
                  : n > 0
                    ? 'Lo que el cliente debe.'
                    : n < 0
                      ? 'A favor del cliente.'
                      : 'Sin deuda.'
              }
            />
          );
        })}
        <section className="rounded-fk border border-fk-borde bg-fk-blanco px-5 py-4 text-sm">
          <h2 className="fk-etiqueta">Cliente</h2>
          <p className="mt-2 tabular-nums">{documentoCliente(cliente)}</p>
          <p className="mt-1 text-fk-gris-texto">
            {cliente.diasVencimiento != null ? `Vence a los ${cliente.diasVencimiento} días` : 'Sin días de vencimiento'} ·{' '}
            <Link to={`/clientes/${cliente.id}`} className="font-medium text-fk-fiordo underline underline-offset-2">
              Ver ficha
            </Link>
          </p>
        </section>
      </div>

      <Tarjeta titulo="Movimientos">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Filtrar movimientos" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-fk px-3 text-sm font-medium transition-colors ${
                  filtro === f.id ? 'bg-fk-fiordo text-fk-blanco' : 'text-fk-gris-texto hover:bg-fk-niebla hover:text-fk-fiordo'
                }`}
              >
                <f.icono className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {f.texto}
              </button>
            ))}
          </div>
          {monedas.length > 1 && (
            <Selector aria-label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda | '')} className="ml-auto w-auto">
              <option value="">Todas las monedas</option>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </Selector>
          )}
        </div>

        {data.movimientos.length === 0 ? (
          <Vacio accion={<Boton variante="terciario" onClick={() => setModal({ tipo: 'nuevo' })}>Cargar saldo inicial</Boton>}>
            Todavía no hay movimientos. Las facturas emitidas y los recibos de cobro aparecen acá solos.
          </Vacio>
        ) : visibles.length === 0 ? (
          <Vacio>No hay movimientos con este filtro.</Vacio>
        ) : (
          <ContenedorTabla>
            <table className="fk-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Comprobante</th>
                  <th>Vencimiento</th>
                  <th className="fk-num">Debe</th>
                  <th className="fk-num">Haber</th>
                  <th className="fk-num">Pendiente</th>
                  <th className="fk-num">Saldo</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((m) => (
                  <FilaMovimiento key={m.id} m={m} onAccion={(tipo) => setModal({ tipo, movimiento: m })} />
                ))}
              </tbody>
            </table>
          </ContenedorTabla>
        )}
      </Tarjeta>

      {modal?.tipo === 'nuevo' && (
        <MovimientoModal clienteId={cliente.id} monedaInicial={cliente.monedaPreferida} pendientes={pendientesDebe} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === 'editar' && (
        <MovimientoModal
          clienteId={cliente.id}
          monedaInicial={modal.movimiento.moneda}
          movimiento={modal.movimiento}
          pendientes={[]}
          onCerrar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'imputar' && <ImputarModal movimiento={modal.movimiento} movimientos={[...data.movimientos].reverse()} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'imputaciones' && <ImputacionesModal movimiento={modal.movimiento} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'vencimiento' && <VencimientoModal movimiento={modal.movimiento} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'eliminar' && <EliminarMovimientoModal movimiento={modal.movimiento} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function FilaMovimiento({
  m,
  onAccion,
}: {
  m: MovimientoCc;
  onAccion: (tipo: 'editar' | 'imputar' | 'imputaciones' | 'vencimiento' | 'eliminar') => void;
}) {
  const ruta = rutaOrigen(m);
  const esDebe = m.tipo === 'DEBE';
  const pendiente = Number(m.pendiente);
  const saldo = Number(m.saldo);
  const manual = m.origen === 'MANUAL';
  return (
    <tr>
      <td className="whitespace-nowrap tabular-nums">{fecha(m.fecha)}</td>
      <td>
        {ruta ? (
          <Link to={ruta} className="font-medium text-fk-fiordo underline-offset-2 hover:underline">
            {m.concepto}
          </Link>
        ) : (
          <span className="font-medium">{m.concepto}</span>
        )}
        {m.numero && <span className="ml-1.5 tabular-nums">{m.numero}</span>}
        {m.anulado && <span className="ml-1.5 text-xs text-fk-gris-texto">(anulado)</span>}
        {m.proyecto && (
          <Link to={`/proyectos/${m.proyecto.id}`} className="block text-xs text-fk-fiordo hover:underline">
            {m.proyecto.nombre}
          </Link>
        )}
        {m.monedaOrigen && m.importeOrigen && (
          <span className="block text-xs text-fk-gris-texto">
            Pagó {dinero(m.importeOrigen, m.monedaOrigen)} a TC {dinero(m.tipoCambio ?? 0)}
          </span>
        )}
        {m.porCertificacion && Number(m.aCertificar) > 0 && (
          <span className="block text-xs text-fk-gris-texto">{dinero(m.aCertificar ?? 0, m.moneda)} a certificar</span>
        )}
        {m.observaciones && <span className="block text-xs text-fk-gris-texto">{m.observaciones}</span>}
      </td>
      <td className="whitespace-nowrap tabular-nums">{esDebe ? fecha(m.fechaVencimiento) : ''}</td>
      <td className="fk-num whitespace-nowrap">{esDebe ? dinero(m.importe, m.moneda) : ''}</td>
      <td className="fk-num whitespace-nowrap">{esDebe ? '' : dinero(m.importe, m.moneda)}</td>
      <td className={`fk-num whitespace-nowrap ${pendiente === 0 ? 'text-fk-gris-texto' : ''}`}>{dinero(pendiente, m.moneda)}</td>
      <td className={`fk-num whitespace-nowrap font-medium ${saldo < 0 ? 'text-fk-ok-texto' : ''}`}>{dinero(saldo, m.moneda)}</td>
      <td className="whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <EtiquetaEstado estado={ESTADOS_CC[m.tipo][m.estado]} />
          {m.vencido && <EtiquetaEstado estado={VENCIDO} />}
        </span>
      </td>
      <td className="py-1">
        <div className="flex justify-end gap-1">
          {pendiente > 0 && <BotonIcono etiqueta={esDebe ? 'Aplicar un cobro' : 'Imputar a un comprobante'} icono={Link2} onClick={() => onAccion('imputar')} />}
          {m.imputaciones.length > 0 && <BotonIcono etiqueta="Ver imputaciones" icono={ListTree} onClick={() => onAccion('imputaciones')} />}
          {esDebe && !manual && <BotonIcono etiqueta="Cambiar vencimiento" icono={CalendarClock} onClick={() => onAccion('vencimiento')} />}
          {manual && <BotonIcono etiqueta="Editar movimiento" icono={Pencil} onClick={() => onAccion('editar')} />}
          {manual && <BotonIcono etiqueta="Eliminar movimiento" icono={Trash2} peligro onClick={() => onAccion('eliminar')} />}
        </div>
      </td>
    </tr>
  );
}
