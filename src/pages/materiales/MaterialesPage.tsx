import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Package, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { claseBoton } from '@/components/estilos';
import { AlertaError, Boton, BotonIcono, Campo, Cargando, ContenedorTabla, EncabezadoPagina, Entrada, EntradaNumero, Etiqueta, Modal, Selector, Tarjeta, Vacio } from '@/components/ui';
import { dinero, fecha, fechaHora, saldosTexto, UNIDADES_MATERIAL } from '@/lib/formato';
import { useEmpresa } from '@/lib/modulos';
import type { ListadoResumen, Material, Moneda, Proveedor } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

const PESTANAS = [
  { id: 'listados', texto: 'Listados', icono: ClipboardList },
  { id: 'catalogo', texto: 'Catálogo', icono: Package },
  { id: 'proveedores', texto: 'Proveedores', icono: Truck },
] as const;
type Pestana = (typeof PESTANAS)[number]['id'];

/** Materiales: listados por obra, catálogo con costo y venta, y proveedores. */
export function MaterialesPage() {
  const [params, setParams] = useSearchParams();
  const p = params.get('tab');
  const pestana: Pestana = PESTANAS.some((x) => x.id === p) ? (p as Pestana) : 'listados';
  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Materiales"
        tituloEnBarra
        acciones={
          pestana === 'listados' && (
            <Link to="/materiales/listados/nuevo" className={claseBoton('primario')}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Nuevo listado
            </Link>
          )
        }
      />
      <div role="tablist" aria-label="Materiales" className="flex gap-1 overflow-x-auto border-b border-fk-borde [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PESTANAS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={pestana === x.id}
            onClick={() => setParams(x.id === 'listados' ? {} : { tab: x.id }, { replace: true })}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm whitespace-nowrap ${
              pestana === x.id ? 'border-fk-fiordo font-semibold text-fk-fiordo' : 'border-transparent font-medium text-fk-gris-texto hover:text-fk-grafito'
            }`}
          >
            <x.icono className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {x.texto}
          </button>
        ))}
      </div>
      {pestana === 'listados' && <Listados />}
      {pestana === 'catalogo' && <Catalogo />}
      {pestana === 'proveedores' && <Proveedores />}
    </div>
  );
}

function Listados() {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const { etiqueta } = useEmpresa();
  const [busqueda, setBusqueda] = useState('');
  const q = useDeferredValue(busqueda.trim());
  const { data, error } = useQuery({ queryKey: ['listados', q], queryFn: () => pedir<ListadoResumen[]>(`/listados-materiales${q ? `?q=${encodeURIComponent(q)}` : ''}`) });
  return (
    <Tarjeta>
      <Entrada type="search" placeholder="Buscar por título o destino" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="mb-5 max-w-sm" />
      <AlertaError error={error} />
      {!data ? (
        <Cargando />
      ) : data.length === 0 ? (
        <Vacio
          accion={
            <Link to="/materiales/listados/nuevo" className={claseBoton('terciario')}>
              Armar un listado
            </Link>
          }
        >
          Todavía no hay listados de materiales.
        </Vacio>
      ) : (
        <ContenedorTabla>
          <table className="fk-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Título</th>
                <th>{etiqueta}</th>
                <th>Proveedor</th>
                <th className="fk-num">Renglones</th>
                <th className="fk-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id} className="cursor-pointer" onClick={() => navigate(`/materiales/listados/${l.id}`)}>
                  <td className="tabular-nums">{fecha(l.fecha)}</td>
                  <td>
                    <Link to={`/materiales/listados/${l.id}`} className="font-semibold text-fk-fiordo hover:underline" onClick={(e) => e.stopPropagation()}>
                      {l.titulo}
                    </Link>
                  </td>
                  <td>{l.proyecto?.nombre ?? '—'}</td>
                  <td>{l.proveedor?.nombre ?? '—'}</td>
                  <td className="fk-num">{l.renglones}</td>
                  <td className="fk-num">{l.precios === 'NINGUNO' ? 'Sin precios' : saldosTexto(l.totales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContenedorTabla>
      )}
    </Tarjeta>
  );
}

function Catalogo() {
  const { pedir } = useApi();
  const [busqueda, setBusqueda] = useState('');
  const [inactivos, setInactivos] = useState(false);
  const [editando, setEditando] = useState<Material | 'nuevo' | null>(null);
  const q = useDeferredValue(busqueda.trim());
  const parametros = new URLSearchParams({ ...(q ? { q } : {}), ...(inactivos ? { inactivos: 'true' } : {}) }).toString();
  const { data, error } = useQuery({ queryKey: ['materiales', parametros], queryFn: () => pedir<Material[]>(`/materiales?${parametros}`) });
  return (
    <Tarjeta
      titulo="Catálogo"
      acciones={
        <Boton variante="terciario" onClick={() => setEditando('nuevo')}>
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nuevo material
        </Boton>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Entrada type="search" placeholder="Buscar por nombre o categoría" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
        <label className="flex items-center gap-2 text-sm text-fk-gris-texto">
          <input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
          Ver desactivados
        </label>
      </div>
      <AlertaError error={error} />
      {!data ? (
        <Cargando />
      ) : data.length === 0 ? (
        <Vacio>Todavía no hay materiales en el catálogo.</Vacio>
      ) : (
        <ContenedorTabla>
          <table className="fk-tabla">
            <thead>
              <tr>
                <th>Material</th>
                <th>Unidad</th>
                <th>Proveedor habitual</th>
                <th className="fk-num">Costo</th>
                <th className="fk-num">Venta</th>
                <th>Actualizado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id} className={m.activo ? '' : 'text-fk-gris-texto'}>
                  <td>
                    <span className="font-medium">{m.nombre}</span>
                    {m.categoria && <span className="block text-xs text-fk-gris-texto">{m.categoria}</span>}
                    {!m.activo && <Etiqueta tono="info">Desactivado</Etiqueta>}
                  </td>
                  <td>{m.unidad}</td>
                  <td>{m.proveedor?.nombre ?? '—'}</td>
                  <td className="fk-num">{m.precioCosto ? dinero(m.precioCosto, m.monedaCosto) : '—'}</td>
                  <td className="fk-num">{m.precioVenta ? dinero(m.precioVenta, m.monedaVenta) : '—'}</td>
                  <td className="text-xs text-fk-gris-texto tabular-nums">{m.preciosActualizadosEn ? fechaHora(m.preciosActualizadosEn).slice(0, 10) : '—'}</td>
                  <td className="text-right">
                    <BotonIcono etiqueta="Editar" icono={Pencil} onClick={() => setEditando(m)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContenedorTabla>
      )}
      {editando && <MaterialModal material={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)} />}
    </Tarjeta>
  );
}

function MaterialModal({ material, onCerrar }: { material: Material | null; onCerrar: () => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const proveedores = useQuery({ queryKey: ['proveedores', ''], queryFn: () => pedir<Proveedor[]>('/proveedores') });
  const [f, setF] = useState({
    nombre: material?.nombre ?? '',
    unidad: material?.unidad ?? 'unidades',
    categoria: material?.categoria ?? '',
    precioCosto: material?.precioCosto ?? '',
    monedaCosto: material?.monedaCosto ?? ('ARS' as Moneda),
    precioVenta: material?.precioVenta ?? '',
    monedaVenta: material?.monedaVenta ?? ('ARS' as Moneda),
    proveedorId: material?.proveedorId ?? '',
    activo: material?.activo ?? true,
  });
  const cambiar = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const guardar = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        categoria: f.categoria.trim() || null,
        precioCosto: f.precioCosto ? Number(f.precioCosto).toFixed(2) : null,
        precioVenta: f.precioVenta ? Number(f.precioVenta).toFixed(2) : null,
        proveedorId: f.proveedorId || null,
      };
      return material ? pedir(`/materiales/${material.id}`, 'PATCH', body) : pedir('/materiales', 'POST', body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['materiales'] });
      onCerrar();
    },
  });
  const eliminar = useMutation({
    mutationFn: () => pedir(`/materiales/${material!.id}`, 'DELETE'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['materiales'] });
      onCerrar();
    },
  });
  return (
    <Modal abierto titulo={material ? 'Editar material' : 'Nuevo material'} onCerrar={onCerrar}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <Campo etiqueta="Nombre">
          <Entrada value={f.nombre} onChange={(e) => cambiar('nombre', e.target.value)} required maxLength={200} autoFocus />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Unidad">
            <Entrada value={f.unidad} onChange={(e) => cambiar('unidad', e.target.value)} required maxLength={30} list="unidades-material" />
            <datalist id="unidades-material">
              {UNIDADES_MATERIAL.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Campo>
          <Campo etiqueta="Categoría">
            <Entrada value={f.categoria} onChange={(e) => cambiar('categoria', e.target.value)} maxLength={60} placeholder="Perfiles, chapas…" />
          </Campo>
          <Campo etiqueta="Precio de costo">
            <div className="flex gap-2">
              <EntradaNumero value={f.precioCosto} onValueChange={(v) => cambiar('precioCosto', v)} sinNegativos />
              <Selector aria-label="Moneda del costo" value={f.monedaCosto} onChange={(e) => cambiar('monedaCosto', e.target.value as Moneda)} className="w-24">
                <option value="ARS">$</option>
                <option value="USD">US$</option>
              </Selector>
            </div>
          </Campo>
          <Campo etiqueta="Precio de venta" ayuda="Se carga a mano.">
            <div className="flex gap-2">
              <EntradaNumero value={f.precioVenta} onValueChange={(v) => cambiar('precioVenta', v)} sinNegativos />
              <Selector aria-label="Moneda de la venta" value={f.monedaVenta} onChange={(e) => cambiar('monedaVenta', e.target.value as Moneda)} className="w-24">
                <option value="ARS">$</option>
                <option value="USD">US$</option>
              </Selector>
            </div>
          </Campo>
          <Campo etiqueta="Proveedor habitual" className="sm:col-span-2">
            <Selector value={f.proveedorId} onChange={(e) => cambiar('proveedorId', e.target.value)}>
              <option value="">Sin proveedor</option>
              {(proveedores.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>
        {material && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
            Activo
          </label>
        )}
        <AlertaError error={guardar.error ?? eliminar.error} />
        <div className="flex justify-between gap-2">
          {material ? (
            <Boton variante="destructivo" onClick={() => eliminar.mutate()} cargando={eliminar.isPending}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Borrar
            </Boton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Boton variante="terciario" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={guardar.isPending}>
              Guardar
            </Boton>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Proveedores() {
  const { pedir } = useApi();
  const [inactivos, setInactivos] = useState(false);
  const [editando, setEditando] = useState<Proveedor | 'nuevo' | null>(null);
  const { data, error } = useQuery({ queryKey: ['proveedores', inactivos ? 'todos' : ''], queryFn: () => pedir<Proveedor[]>(`/proveedores${inactivos ? '?inactivos=true' : ''}`) });
  return (
    <Tarjeta
      titulo="Proveedores"
      acciones={
        <Boton variante="terciario" onClick={() => setEditando('nuevo')}>
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nuevo proveedor
        </Boton>
      }
    >
      <label className="mb-5 flex items-center gap-2 text-sm text-fk-gris-texto">
        <input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
        Ver desactivados
      </label>
      <AlertaError error={error} />
      {!data ? (
        <Cargando />
      ) : data.length === 0 ? (
        <Vacio>Todavía no cargaste proveedores.</Vacio>
      ) : (
        <ContenedorTabla>
          <table className="fk-tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'text-fk-gris-texto'}>
                  <td className="font-medium">
                    {p.nombre} {!p.activo && <Etiqueta tono="info">Desactivado</Etiqueta>}
                  </td>
                  <td>{p.contacto ?? '—'}</td>
                  <td className="tabular-nums">{p.telefono ?? '—'}</td>
                  <td>{p.email ?? '—'}</td>
                  <td className="text-right">
                    <BotonIcono etiqueta="Editar" icono={Pencil} onClick={() => setEditando(p)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContenedorTabla>
      )}
      {editando && <ProveedorModal proveedor={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)} />}
    </Tarjeta>
  );
}

function ProveedorModal({ proveedor, onCerrar }: { proveedor: Proveedor | null; onCerrar: () => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [f, setF] = useState({
    nombre: proveedor?.nombre ?? '',
    cuit: proveedor?.cuit ?? '',
    contacto: proveedor?.contacto ?? '',
    telefono: proveedor?.telefono ?? '',
    email: proveedor?.email ?? '',
    notas: proveedor?.notas ?? '',
    activo: proveedor?.activo ?? true,
  });
  const cambiar = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['proveedores'] });
    onCerrar();
  };
  const guardar = useMutation({ mutationFn: () => (proveedor ? pedir(`/proveedores/${proveedor.id}`, 'PATCH', f) : pedir('/proveedores', 'POST', f)), onSuccess: refrescar });
  const eliminar = useMutation({ mutationFn: () => pedir(`/proveedores/${proveedor!.id}`, 'DELETE'), onSuccess: refrescar });
  return (
    <Modal abierto titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'} onCerrar={onCerrar}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <Campo etiqueta="Nombre o razón social">
          <Entrada value={f.nombre} onChange={(e) => cambiar('nombre', e.target.value)} required maxLength={200} autoFocus />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="CUIT" ayuda="Opcional.">
            <Entrada value={f.cuit} onChange={(e) => cambiar('cuit', e.target.value)} maxLength={13} inputMode="numeric" />
          </Campo>
          <Campo etiqueta="Contacto">
            <Entrada value={f.contacto} onChange={(e) => cambiar('contacto', e.target.value)} maxLength={120} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <Entrada value={f.telefono} onChange={(e) => cambiar('telefono', e.target.value)} maxLength={60} />
          </Campo>
          <Campo etiqueta="Email">
            <Entrada type="email" value={f.email} onChange={(e) => cambiar('email', e.target.value)} maxLength={120} />
          </Campo>
        </div>
        <Campo etiqueta="Notas">
          <Entrada value={f.notas} onChange={(e) => cambiar('notas', e.target.value)} maxLength={1000} />
        </Campo>
        {proveedor && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
            Activo
          </label>
        )}
        <AlertaError error={guardar.error ?? eliminar.error} />
        <div className="flex justify-between gap-2">
          {proveedor ? (
            <Boton variante="destructivo" onClick={() => eliminar.mutate()} cargando={eliminar.isPending}>
              Borrar
            </Boton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Boton variante="terciario" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={guardar.isPending}>
              Guardar
            </Boton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
