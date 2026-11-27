import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { AlertaError, Aviso, Boton, BotonIcono, Campo, Cargando, ContenedorTabla, EncabezadoPagina, Entrada, EntradaNumero, Selector, SelectorBuscable, Tarjeta } from '@/components/ui';
import { claseInput } from '@/components/ui';
import { dinero, hoy, PRECIOS_LISTADO } from '@/lib/formato';
import { useEmpresa } from '@/lib/modulos';
import type { ListadoMateriales, Material, Moneda, PreciosListado, PresupuestoResumen, ProyectoResumen, Proveedor } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

interface RenglonForm {
  clave: string;
  renglonId?: string;
  materialId: string;
  nombre: string;
  unidad: string;
  cantidad: string;
  /** Precios copiados (los del renglón guardado) o los del catálogo si es nuevo. */
  precioCosto: string | null;
  monedaCosto: Moneda | null;
  precioVenta: string | null;
  monedaVenta: Moneda | null;
}

let n = 0;
const vacio = (): RenglonForm => ({ clave: `r${++n}`, materialId: '', nombre: '', unidad: '', cantidad: '', precioCosto: null, monedaCosto: null, precioVenta: null, monedaVenta: null });

/** Alta y edición de un listado de materiales (pedido al proveedor o cálculo para el cliente). */
export function ListadoPage() {
  const { id } = useParams();
  const { pedir } = useApi();
  const existente = useQuery({ queryKey: ['listado', id], queryFn: () => pedir<ListadoMateriales>(`/listados-materiales/${id}`), enabled: Boolean(id) });
  if (existente.error) return <AlertaError error={existente.error} />;
  if (id && !existente.data) return <Cargando />;
  return <Formulario key={existente.data ? `${existente.data.id}-${existente.dataUpdatedAt}` : 'nuevo'} listado={existente.data} />;
}

function Formulario({ listado }: { listado?: ListadoMateriales }) {
  const { pedir, verEnPestana } = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const { etiqueta, tiene } = useEmpresa();
  const materiales = useQuery({ queryKey: ['materiales', ''], queryFn: () => pedir<Material[]>('/materiales') });
  const proveedores = useQuery({ queryKey: ['proveedores', ''], queryFn: () => pedir<Proveedor[]>('/proveedores') });
  const proyectos = useQuery({ queryKey: ['proyectos', 'todos'], queryFn: () => pedir<ProyectoResumen[]>('/proyectos'), enabled: tiene('proyectos') });
  const presupuestos = useQuery({ queryKey: ['presupuestos', 'todos'], queryFn: () => pedir<PresupuestoResumen[]>('/presupuestos'), enabled: tiene('presupuestos') });

  const [titulo, setTitulo] = useState(listado?.titulo ?? 'Cálculo aproximado de materiales');
  const [fecha, setFecha] = useState(listado?.fecha ?? hoy());
  const [proyectoId, setProyectoId] = useState(listado?.proyecto?.id ?? params.get('proyecto') ?? '');
  const [presupuestoId, setPresupuestoId] = useState(listado?.presupuesto?.id ?? '');
  const [proveedorId, setProveedorId] = useState(listado?.proveedor?.id ?? '');
  const [destino, setDestino] = useState(listado?.destino ?? '');
  const [observaciones, setObservaciones] = useState(listado?.observaciones ?? '');
  const [precios, setPrecios] = useState<PreciosListado>(listado?.precios ?? 'NINGUNO');
  const [renglones, setRenglones] = useState<RenglonForm[]>(
    listado?.renglones.map((r) => ({ clave: r.id, renglonId: r.id, materialId: r.materialId ?? '', nombre: r.nombre, unidad: r.unidad, cantidad: r.cantidad, precioCosto: r.precioCosto, monedaCosto: r.monedaCosto, precioVenta: r.precioVenta, monedaVenta: r.monedaVenta })) ?? [vacio()],
  );
  const [errorPdf, setErrorPdf] = useState<unknown>(null);

  const porId = useMemo(() => new Map((materiales.data ?? []).map((m) => [m.id, m])), [materiales.data]);
  function elegirMaterial(clave: string, materialId: string) {
    const m = porId.get(materialId);
    setRenglones((rs) =>
      rs.map((r) =>
        r.clave === clave
          ? {
              ...r,
              materialId,
              renglonId: undefined,
              nombre: m?.nombre ?? r.nombre,
              unidad: m?.unidad ?? r.unidad,
              precioCosto: m?.precioCosto ?? null,
              monedaCosto: m?.precioCosto ? m.monedaCosto : null,
              precioVenta: m?.precioVenta ?? null,
              monedaVenta: m?.precioVenta ? m.monedaVenta : null,
            }
          : r,
      ),
    );
  }
  const cambiar = (clave: string, campo: keyof RenglonForm, valor: string) => setRenglones((rs) => rs.map((r) => (r.clave === clave ? { ...r, [campo]: valor } : r)));
  const mover = (i: number, d: -1 | 1) =>
    setRenglones((xs) => {
      const c = [...xs];
      const [x] = c.splice(i, 1);
      c.splice(i + d, 0, x);
      return c;
    });

  const precioDe = (r: RenglonForm) => (precios === 'COSTO' ? { p: r.precioCosto, m: r.monedaCosto } : precios === 'VENTA' ? { p: r.precioVenta, m: r.monedaVenta } : null);
  const totales = useMemo(() => {
    const t = new Map<Moneda, number>();
    for (const r of renglones) {
      const x = precioDe(r);
      if (x?.p && x.m && Number(r.cantidad)) t.set(x.m, (t.get(x.m) ?? 0) + Math.round(Number(r.cantidad) * Number(x.p) * 100) / 100);
    }
    return [...t.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renglones, precios]);

  const body = () => ({
    titulo: titulo.trim(),
    fecha,
    proyectoId: proyectoId || null,
    presupuestoId: presupuestoId || null,
    proveedorId: proveedorId || null,
    destino: destino.trim() || null,
    observaciones: observaciones.trim() || null,
    precios,
    renglones: renglones
      .filter((r) => r.materialId || r.nombre.trim())
      .map((r) => ({
        ...(r.renglonId ? { renglonId: r.renglonId } : {}),
        cantidad: String(Number(r.cantidad) || 0),
        ...(r.materialId ? { materialId: r.materialId } : {}),
        nombre: r.nombre.trim() || undefined,
        unidad: r.unidad.trim() || undefined,
      })),
  });
  const alGuardar = (l: ListadoMateriales) => {
    queryClient.setQueryData(['listado', l.id], l);
    void queryClient.invalidateQueries({ queryKey: ['listados'] });
    if (!listado) navigate(`/materiales/listados/${l.id}`, { replace: true });
  };
  const guardar = useMutation({
    mutationFn: () => (listado ? pedir<ListadoMateriales>(`/listados-materiales/${listado.id}`, 'PUT', body()) : pedir<ListadoMateriales>('/listados-materiales', 'POST', body())),
    onSuccess: alGuardar,
  });
  const actualizarPrecios = useMutation({
    mutationFn: () => pedir<ListadoMateriales>(`/listados-materiales/${listado!.id}/actualizar-precios`, 'POST'),
    onSuccess: (l) => queryClient.setQueryData(['listado', l.id], l),
  });
  const duplicar = useMutation({
    mutationFn: () => pedir<ListadoMateriales>(`/listados-materiales/${listado!.id}/duplicar`, 'POST'),
    onSuccess: (l) => {
      void queryClient.invalidateQueries({ queryKey: ['listados'] });
      navigate(`/materiales/listados/${l.id}`);
    },
  });
  const eliminar = useMutation({
    mutationFn: () => pedir(`/listados-materiales/${listado!.id}`, 'DELETE'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['listados'] });
      navigate('/materiales', { replace: true });
    },
  });

  async function verPdf() {
    setErrorPdf(null);
    try {
      await verEnPestana(`/listados-materiales/${listado!.id}/pdf`);
    } catch (err) {
      setErrorPdf(err);
    }
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  const opcionesMateriales = (materiales.data ?? []).map((m) => ({ value: m.id, label: `${m.nombre} (${m.unidad})` }));
  return (
    <form onSubmit={enviar} className="space-y-6">
      <EncabezadoPagina
        titulo={listado ? listado.titulo : 'Nuevo listado'}
        tituloEnBarra
        migas={[{ texto: 'Materiales', a: '/materiales' }, { texto: listado ? listado.titulo : 'Nuevo listado' }]}
        acciones={
          listado && (
            <>
              <Boton variante="terciario" onClick={() => duplicar.mutate()} cargando={duplicar.isPending}>
                <Copy className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Duplicar
              </Boton>
              <Boton variante="terciario" onClick={() => void verPdf()}>
                <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Ver PDF
              </Boton>
            </>
          )
        }
      />
      <AlertaError error={errorPdf ?? duplicar.error ?? eliminar.error ?? actualizarPrecios.error} />
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Tarjeta titulo="Datos">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Título" className="sm:col-span-2">
              <Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} />
            </Campo>
            <Campo etiqueta="Fecha">
              <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </Campo>
            <Campo etiqueta="Proveedor destinatario" ayuda="Opcional.">
              <Selector value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                <option value="">Sin proveedor</option>
                {(proveedores.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            {tiene('proyectos') && (
              <Campo etiqueta={etiqueta}>
                <SelectorBuscable value={proyectoId} onChange={setProyectoId} placeholder={`Sin ${etiqueta.toLowerCase()}`} aria-label={etiqueta} opciones={(proyectos.data ?? []).map((p) => ({ value: p.id, label: `${p.nombre} · ${p.cliente.razonSocial}` }))} />
              </Campo>
            )}
            {tiene('presupuestos') && (
              <Campo etiqueta="Presupuesto">
                <SelectorBuscable value={presupuestoId} onChange={setPresupuestoId} placeholder="Sin presupuesto" aria-label="Presupuesto" opciones={(presupuestos.data ?? []).map((p) => ({ value: p.id, label: `${p.numero} · ${p.cliente.razonSocial}` }))} />
              </Campo>
            )}
            <Campo etiqueta="Entrega en" className="sm:col-span-2">
              <Entrada value={destino} onChange={(e) => setDestino(e.target.value)} maxLength={300} placeholder="Dirección o destino de entrega" />
            </Campo>
          </div>
        </Tarjeta>
        <Tarjeta titulo="PDF">
          <div className="space-y-4">
            <Campo etiqueta="Precios que muestra">
              <Selector value={precios} onChange={(e) => setPrecios(e.target.value as PreciosListado)}>
                {Object.entries(PRECIOS_LISTADO).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Observaciones" ayuda="Una por renglón. Por ejemplo, qué no contempla el cálculo.">
              <textarea className={`${claseInput} h-28`} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={3000} />
            </Campo>
            {listado && (
              <Aviso tono="azul">
                Los precios quedan copiados al armar el listado: cambiar el catálogo no lo modifica.{' '}
                <button type="button" className="font-semibold text-fk-fiordo underline-offset-2 hover:underline" onClick={() => actualizarPrecios.mutate()}>
                  <RefreshCw className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  Actualizar con el catálogo
                </button>
              </Aviso>
            )}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Renglones">
        <ContenedorTabla>
          <table className="fk-tabla">
            <thead>
              <tr>
                <th className="w-28">Cantidad</th>
                <th>Material</th>
                <th className="w-32">Unidad</th>
                {precios !== 'NINGUNO' && <th className="fk-num">Precio</th>}
                {precios !== 'NINGUNO' && <th className="fk-num">Subtotal</th>}
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {renglones.map((r, i) => {
                const x = precioDe(r);
                return (
                  <tr key={r.clave}>
                    <td>
                      <EntradaNumero aria-label={`Cantidad del renglón ${i + 1}`} value={r.cantidad} onValueChange={(v) => cambiar(r.clave, 'cantidad', v)} maxDecimales={3} sinNegativos />
                    </td>
                    <td className="min-w-72">
                      <div className="grid gap-1">
                        <SelectorBuscable value={r.materialId} onChange={(v) => elegirMaterial(r.clave, v)} placeholder="Texto libre" aria-label={`Material del renglón ${i + 1}`} opciones={opcionesMateriales} />
                        {!r.materialId && <Entrada aria-label={`Descripción del renglón ${i + 1}`} value={r.nombre} onChange={(e) => cambiar(r.clave, 'nombre', e.target.value)} placeholder="Qué es" maxLength={300} />}
                      </div>
                    </td>
                    <td>
                      <Entrada aria-label={`Unidad del renglón ${i + 1}`} value={r.unidad} onChange={(e) => cambiar(r.clave, 'unidad', e.target.value)} maxLength={30} list="unidades-listado" />
                    </td>
                    {precios !== 'NINGUNO' && <td className="fk-num">{x?.p && x.m ? dinero(x.p, x.m) : '—'}</td>}
                    {precios !== 'NINGUNO' && <td className="fk-num">{x?.p && x.m && Number(r.cantidad) ? dinero(Math.round(Number(r.cantidad) * Number(x.p) * 100) / 100, x.m) : '—'}</td>}
                    <td className="whitespace-nowrap text-right">
                      <BotonIcono etiqueta="Subir" icono={ArrowUp} disabled={i === 0} onClick={() => mover(i, -1)} />
                      <BotonIcono etiqueta="Bajar" icono={ArrowDown} disabled={i === renglones.length - 1} onClick={() => mover(i, 1)} className="ml-1" />
                      <BotonIcono etiqueta="Quitar renglón" icono={Trash2} peligro onClick={() => setRenglones((rs) => rs.filter((y) => y.clave !== r.clave))} className="ml-1" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ContenedorTabla>
        <datalist id="unidades-listado">
          {['barras', 'metros', 'chapas', 'unidades', 'litros', 'm³', 'kg', 'rollos'].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <Boton variante="terciario" onClick={() => setRenglones((rs) => [...rs, vacio()])}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Agregar renglón
          </Boton>
          {precios !== 'NINGUNO' && (
            <dl className="space-y-1 text-right">
              {totales.map(([m, t]) => (
                <div key={m} className="flex justify-end gap-6 text-base font-semibold text-fk-fiordo">
                  <dt>Total en {m === 'USD' ? 'dólares' : 'pesos'}</dt>
                  <dd className="fk-num">{dinero(t, m)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </Tarjeta>

      <AlertaError error={guardar.error} />
      <div className="flex flex-wrap justify-end gap-2">
        {listado && (
          <Boton variante="destructivo" onClick={() => window.confirm('¿Borrar este listado?') && eliminar.mutate()} cargando={eliminar.isPending}>
            Borrar
          </Boton>
        )}
        <Boton variante="terciario" onClick={() => navigate('/materiales')}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={guardar.isPending}>
          {listado ? 'Guardar cambios' : 'Guardar listado'}
        </Boton>
      </div>
    </form>
  );
}
