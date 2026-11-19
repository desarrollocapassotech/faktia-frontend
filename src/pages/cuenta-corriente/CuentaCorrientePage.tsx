import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import {
  AlertaError,
  BotonIcono,
  Cargando,
  ContenedorTabla,
  EncabezadoPagina,
  Entrada,
  Etiqueta,
  EtiquetaEstado,
  Tarjeta,
  TituloOrdenable,
  Vacio,
} from '@/components/ui';
import { dinero, documentoCliente, fecha, saldosTexto, VENCIDO } from '@/lib/formato';
import { useOrdenColumna, type OrdenDir } from '@/lib/orden';
import type { CuentaCc, Moneda, PendienteCc, ResumenCc } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

const DIAS_PROXIMOS = 15;
const MAX_PENDIENTES = 10;

type OrdenCuentas = 'cliente' | 'vencimiento' | `saldo-${Moneda}`;

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const saldoEn = (c: CuentaCc, moneda: Moneda) => Number(c.saldos.find((s) => s.moneda === moneda)?.saldo ?? 0);
const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Sin columna elegida (como en Vialto): primero el vencimiento más viejo y al final las cuentas sin
 * vencimiento; a igual vencimiento, las que más deben; después, por nombre.
 */
function ordenarCuentas(lista: CuentaCc[], orden: { por: OrdenCuentas; dir: OrdenDir } | null, monedas: Moneda[]): CuentaCc[] {
  const porNombre = (a: CuentaCc, b: CuentaCc) => collator.compare(a.razonSocial, b.razonSocial);
  const porSaldos = (a: CuentaCc, b: CuentaCc, signo: number) => {
    for (const m of monedas) {
      const d = saldoEn(a, m) - saldoEn(b, m);
      if (d !== 0) return signo * d;
    }
    return porNombre(a, b);
  };
  const porVencimiento = (a: CuentaCc, b: CuentaCc, signo: number) => {
    if (a.proximoVencimiento === b.proximoVencimiento) return 0;
    if (!a.proximoVencimiento) return 1;
    if (!b.proximoVencimiento) return -1;
    return signo * a.proximoVencimiento.localeCompare(b.proximoVencimiento);
  };
  return [...lista].sort((a, b) => {
    if (!orden) return porVencimiento(a, b, 1) || porSaldos(a, b, -1);
    const signo = orden.dir === 'asc' ? 1 : -1;
    if (orden.por === 'cliente') return signo * porNombre(a, b);
    if (orden.por === 'vencimiento') return porVencimiento(a, b, signo) || porNombre(a, b);
    const moneda = orden.por.slice(6) as Moneda;
    return signo * (saldoEn(a, moneda) - saldoEn(b, moneda)) || porNombre(a, b);
  });
}

/** Cuenta corriente: lo que hay para cobrar, lo vencido y el saldo de cada cliente. */
export function CuentaCorrientePage() {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [soloConSaldo, setSoloConSaldo] = useState(true);
  const q = normalizar(useDeferredValue(busqueda.trim()));

  const resumen = useQuery({
    queryKey: ['cuenta-corriente', 'resumen', DIAS_PROXIMOS],
    queryFn: () => pedir<ResumenCc>(`/cuenta-corriente/resumen?diasProximos=${DIAS_PROXIMOS}`),
  });
  const cuentas = useQuery({ queryKey: ['cuenta-corriente', 'cuentas'], queryFn: () => pedir<CuentaCc[]>('/cuenta-corriente/cuentas') });

  // Una columna de saldo por moneda, nunca sumadas. Pesos primero.
  const monedas = useMemo<Moneda[]>(() => {
    const presentes = new Set((cuentas.data ?? []).flatMap((c) => c.saldos.map((s) => s.moneda)));
    return presentes.has('USD') ? ['ARS', 'USD'] : ['ARS'];
  }, [cuentas.data]);

  const { orden, ordenColumna } = useOrdenColumna<OrdenCuentas>(undefined, { vencimiento: 'fecha', 'saldo-ARS': 'numero', 'saldo-USD': 'numero' });
  const visibles = useMemo(() => {
    const filtradas = (cuentas.data ?? []).filter(
      (c) =>
        (!soloConSaldo || c.saldos.some((s) => Number(s.saldo) !== 0)) &&
        (!q || normalizar(c.razonSocial).includes(q) || c.numeroDocumento.includes(q.replace(/[-.\s]/g, ''))),
    );
    return ordenarCuentas(filtradas, orden, monedas);
  }, [cuentas.data, soloConSaldo, q, orden, monedas]);

  const pendientes = useMemo(
    () => [...(resumen.data?.vencidos ?? []), ...(resumen.data?.proximos ?? [])],
    [resumen.data],
  );
  const idsVencidos = useMemo(() => new Set((resumen.data?.vencidos ?? []).map((v) => v.id)), [resumen.data]);
  const abrir = (clienteId: string) => navigate(`/cuenta-corriente/${clienteId}`);

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Cuenta corriente" tituloEnBarra />

      {resumen.error ? (
        <AlertaError error={resumen.error} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador titulo="Por cobrar" valor={resumen.data ? saldosTexto(resumen.data.porCobrar) : '—'} ayuda="Suma de los saldos de todas las cuentas." />
          <Indicador titulo="Vencido" valor={resumen.data ? saldosTexto(resumen.data.vencido) : '—'} alerta={Boolean(resumen.data?.vencidos.length)} />
          <Indicador titulo={`Vence en ${DIAS_PROXIMOS} días`} valor={resumen.data ? saldosTexto(resumen.data.proximo) : '—'} />
        </div>
      )}

      {pendientes.length > 0 && (
        <Tarjeta titulo="Vencidos y por vencer">
          <ContenedorTabla>
            <table className="fk-tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Comprobante</th>
                  <th>Vencimiento</th>
                  <th className="fk-num">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.slice(0, MAX_PENDIENTES).map((p) => (
                  <FilaPendiente key={p.id} p={p} vencido={idsVencidos.has(p.id)} onAbrir={abrir} />
                ))}
              </tbody>
            </table>
          </ContenedorTabla>
          {pendientes.length > MAX_PENDIENTES && (
            <p className="mt-4 text-sm text-fk-gris-texto">
              Se muestran {MAX_PENDIENTES} de {pendientes.length}. El resto está en la cuenta de cada cliente.
            </p>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo="Cuentas">
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <Entrada type="search" placeholder="Buscar por nombre o documento" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
          <label className="flex items-center gap-2 text-sm text-fk-gris-texto">
            <input type="checkbox" checked={soloConSaldo} onChange={(e) => setSoloConSaldo(e.target.checked)} />
            Solo con saldo
          </label>
        </div>
        {cuentas.error ? (
          <AlertaError error={cuentas.error} />
        ) : !cuentas.data ? (
          <Cargando />
        ) : visibles.length === 0 ? (
          <Vacio>
            {q
              ? 'No hay clientes que coincidan con la búsqueda.'
              : soloConSaldo
                ? 'Ningún cliente tiene saldo. Las facturas emitidas y los recibos de cobro aparecen acá solos.'
                : 'Todavía no cargaste clientes.'}
          </Vacio>
        ) : (
          <ContenedorTabla>
            <table className="fk-tabla">
              <thead>
                <tr>
                  <th>
                    <TituloOrdenable titulo="Cliente" orden={ordenColumna('cliente')} />
                  </th>
                  {monedas.map((m) => (
                    <th key={m} className="fk-num">
                      <TituloOrdenable titulo={`Saldo ${m === 'ARS' ? 'pesos' : 'dólares'}`} orden={ordenColumna(`saldo-${m}`)} />
                    </th>
                  ))}
                  <th>
                    <TituloOrdenable titulo="Próximo vencimiento" orden={ordenColumna('vencimiento')} />
                  </th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr key={c.clienteId} onClick={() => abrir(c.clienteId)} title="Click para ver la cuenta" className="cursor-pointer transition-colors hover:bg-fk-niebla/50">
                    <td>
                      <Link
                        to={`/cuenta-corriente/${c.clienteId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-fk-fiordo underline-offset-2 hover:underline"
                      >
                        {c.razonSocial}
                      </Link>
                      {!c.activo && <Etiqueta className="ml-2">Inactivo</Etiqueta>}
                      <span className="block text-xs text-fk-gris-texto tabular-nums">{documentoCliente(c)}</span>
                    </td>
                    {monedas.map((m) => {
                      const saldo = saldoEn(c, m);
                      return (
                        <td key={m} className={`fk-num whitespace-nowrap ${saldo === 0 ? 'text-fk-gris-texto' : saldo < 0 ? 'text-fk-ok-texto' : 'font-medium'}`}>
                          {dinero(saldo, m)}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap tabular-nums">
                      {c.proximoVencimiento ? (
                        <span className="inline-flex items-center gap-2">
                          {fecha(c.proximoVencimiento)}
                          {c.vencido && <EtiquetaEstado estado={VENCIDO} />}
                        </span>
                      ) : (
                        <span className="text-fk-gris-texto">—</span>
                      )}
                    </td>
                    <td className="py-1" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <BotonIcono etiqueta="Ver cuenta" icono={Wallet} onClick={() => abrir(c.clienteId)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ContenedorTabla>
        )}
      </Tarjeta>
    </div>
  );
}

function FilaPendiente({ p, vencido, onAbrir }: { p: PendienteCc; vencido: boolean; onAbrir: (clienteId: string) => void }) {
  return (
    <tr onClick={() => onAbrir(p.clienteId)} title="Click para ver la cuenta" className="cursor-pointer transition-colors hover:bg-fk-niebla/50">
      <td className="font-medium text-fk-fiordo">{p.razonSocial}</td>
      <td className="whitespace-nowrap">
        {p.concepto} <span className="tabular-nums">{p.numero ?? ''}</span>
      </td>
      <td className="whitespace-nowrap tabular-nums">
        <span className="inline-flex items-center gap-2">
          {fecha(p.fechaVencimiento)}
          {vencido && <EtiquetaEstado estado={VENCIDO} />}
        </span>
      </td>
      <td className="fk-num whitespace-nowrap">{dinero(p.pendiente, p.moneda)}</td>
    </tr>
  );
}

/** Número grande con su título, para el resumen de arriba. */
export function Indicador({ titulo, valor, ayuda, alerta }: { titulo: string; valor: ReactNode; ayuda?: string; alerta?: boolean }) {
  return (
    <section className="rounded-fk border border-fk-borde bg-fk-blanco px-5 py-4">
      <h2 className="fk-etiqueta">{titulo}</h2>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${alerta ? 'text-fk-error-texto' : 'text-fk-fiordo'}`}>{valor}</p>
      {ayuda && <p className="mt-1 text-xs text-fk-gris-texto">{ayuda}</p>}
    </section>
  );
}
