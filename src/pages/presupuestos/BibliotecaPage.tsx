import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListChecks, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { EditorTexto, TextoFormato } from '@/components/EditorTexto';
import { AlertaError, Aviso, Boton, BotonIcono, Campo, Cargando, EncabezadoPagina, Entrada, Modal, Tarjeta, Vacio } from '@/components/ui';
import type { ItemBiblioteca, ObservacionCatalogo } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

type Pestana = 'items' | 'observaciones';

/** Biblioteca de presupuestos: ítems frecuentes (plantillas) y el catálogo de observaciones. */
export function BibliotecaPage() {
  const [pestana, setPestana] = useState<Pestana>('items');
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const cargar = useMutation({
    meta: { exito: 'Biblioteca inicial cargada.', error: 'No se pudo cargar la biblioteca inicial.' },
    mutationFn: () => pedir<{ items: number; observaciones: number }>('/presupuestos/biblioteca/cargar-inicial', 'POST'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['presupuestos'] }),
  });
  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Biblioteca"
        tituloEnBarra
        migas={[{ texto: 'Presupuestos', a: '/presupuestos' }, { texto: 'Biblioteca' }]}
        acciones={
          <Boton variante="terciario" cargando={cargar.isPending} onClick={() => cargar.mutate()}>
            Cargar la biblioteca inicial
          </Boton>
        }
      />
      <AlertaError error={cargar.error} />
      {cargar.data && (
        <Aviso tono="verde">
          Se agregaron {cargar.data.items} ítems y {cargar.data.observaciones} observaciones (lo que ya estaba no se tocó).
        </Aviso>
      )}
      <div role="tablist" aria-label="Biblioteca" className="flex gap-1 overflow-x-auto border-b border-fk-borde [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            { id: 'items', texto: 'Ítems frecuentes', icono: Package },
            { id: 'observaciones', texto: 'Observaciones', icono: ListChecks },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm whitespace-nowrap ${
              pestana === p.id ? 'border-fk-fiordo font-semibold text-fk-fiordo' : 'border-transparent font-medium text-fk-gris-texto hover:text-fk-grafito'
            }`}
          >
            <p.icono className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {p.texto}
          </button>
        ))}
      </div>
      {pestana === 'items' ? <Items /> : <Observaciones />}
    </div>
  );
}

function Items() {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['presupuestos', 'biblioteca'], queryFn: () => pedir<ItemBiblioteca[]>('/presupuestos/biblioteca/items') });
  const [editando, setEditando] = useState<ItemBiblioteca | 'nuevo' | null>(null);
  const eliminar = useMutation({
    meta: { exito: 'Ítem eliminado de la biblioteca.', error: 'No se pudo eliminar el ítem.' },
    mutationFn: (id: string) => pedir(`/presupuestos/biblioteca/items/${id}`, 'DELETE'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['presupuestos', 'biblioteca'] }),
  });
  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  return (
    <Tarjeta
      titulo="Ítems frecuentes"
      acciones={
        <Boton variante="terciario" onClick={() => setEditando('nuevo')}>
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nuevo ítem
        </Boton>
      }
    >
      {data.length === 0 ? (
        <Vacio>Todavía no hay ítems. Cargá la biblioteca inicial o agregá los tuyos.</Vacio>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.map((i) => (
            <li key={i.id} className="flex gap-3 rounded-fk border border-fk-borde p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{i.titulo}</p>
                {i.categoria && <p className="fk-etiqueta mt-0.5">{i.categoria}</p>}
                <TextoFormato html={i.descripcion} className="mt-2 text-fk-gris-texto" />
              </div>
              <div className="flex gap-1">
                <BotonIcono etiqueta="Editar" icono={Pencil} onClick={() => setEditando(i)} />
                <BotonIcono etiqueta="Quitar" icono={Trash2} peligro onClick={() => window.confirm(`¿Quitar "${i.titulo}"?`) && eliminar.mutate(i.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {editando && <ItemModal item={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)} />}
    </Tarjeta>
  );
}

function ItemModal({ item, onCerrar }: { item: ItemBiblioteca | null; onCerrar: () => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState(item?.titulo ?? '');
  const [categoria, setCategoria] = useState(item?.categoria ?? '');
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? '');
  const guardar = useMutation({
    meta: { exito: item ? 'Ítem actualizado.' : 'Ítem agregado a la biblioteca.', error: 'No se pudo guardar el ítem.' },
    mutationFn: () => {
      const body = { titulo: titulo.trim(), categoria: categoria.trim() || undefined, descripcion };
      return item ? pedir(`/presupuestos/biblioteca/items/${item.id}`, 'PUT', body) : pedir('/presupuestos/biblioteca/items', 'POST', body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['presupuestos', 'biblioteca'] });
      onCerrar();
    },
  });
  return (
    <Modal abierto titulo={item ? 'Editar ítem' : 'Nuevo ítem'} onCerrar={onCerrar}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Título">
            <Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={120} autoFocus />
          </Campo>
          <Campo etiqueta="Categoría">
            <Entrada value={categoria} onChange={(e) => setCategoria(e.target.value)} maxLength={60} placeholder="Estructura, techado…" />
          </Campo>
        </div>
        <div className="space-y-2">
          <span className="text-[13px] font-semibold text-fk-grafito">Descripción</span>
          <EditorTexto etiqueta="Descripción" value={descripcion} onChange={setDescripcion} minAlto="min-h-28" />
        </div>
        <AlertaError error={guardar.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

function Observaciones() {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['presupuestos', 'observaciones'], queryFn: () => pedir<ObservacionCatalogo[]>('/presupuestos/biblioteca/observaciones') });
  const [editando, setEditando] = useState<ObservacionCatalogo | 'nueva' | null>(null);
  const eliminar = useMutation({
    meta: { exito: 'Observación eliminada.', error: 'No se pudo eliminar la observación.' },
    mutationFn: (id: string) => pedir(`/presupuestos/biblioteca/observaciones/${id}`, 'DELETE'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['presupuestos', 'observaciones'] }),
  });
  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  return (
    <Tarjeta
      titulo="Observaciones"
      acciones={
        <Boton variante="terciario" onClick={() => setEditando('nueva')}>
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nueva observación
        </Boton>
      }
    >
      <p className="mb-4 text-sm text-fk-gris-texto">Escribí {'{valor}'} donde va lo que se completa en cada presupuesto. Por ejemplo: Plazo de obra: {'{valor}'}.</p>
      {data.length === 0 ? (
        <Vacio>Todavía no hay observaciones.</Vacio>
      ) : (
        <ul className="divide-y divide-fk-borde">
          {data.map((o) => (
            <li key={o.id} className="flex min-h-12 items-center gap-3 py-2">
              <div className="min-w-0 flex-1 text-sm">
                <p>{o.texto}</p>
                <p className="text-xs text-fk-gris-texto">
                  {[o.porDefecto ? 'Tildada por defecto' : null, o.llevaValor && o.valorSugerido ? `Valor sugerido: ${o.valorSugerido}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <BotonIcono etiqueta="Editar" icono={Pencil} onClick={() => setEditando(o)} />
              <BotonIcono etiqueta="Quitar" icono={Trash2} peligro onClick={() => eliminar.mutate(o.id)} />
            </li>
          ))}
        </ul>
      )}
      {editando && <ObservacionModal observacion={editando === 'nueva' ? null : editando} onCerrar={() => setEditando(null)} />}
    </Tarjeta>
  );
}

function ObservacionModal({ observacion, onCerrar }: { observacion: ObservacionCatalogo | null; onCerrar: () => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState(observacion?.texto ?? '');
  const [valorSugerido, setValorSugerido] = useState(observacion?.valorSugerido ?? '');
  const [porDefecto, setPorDefecto] = useState(observacion?.porDefecto ?? false);
  const guardar = useMutation({
    meta: { exito: observacion ? 'Observación actualizada.' : 'Observación agregada.', error: 'No se pudo guardar la observación.' },
    mutationFn: () => {
      const body = { texto: texto.trim(), llevaValor: texto.includes('{valor}'), valorSugerido: valorSugerido.trim() || undefined, porDefecto };
      return observacion ? pedir(`/presupuestos/biblioteca/observaciones/${observacion.id}`, 'PUT', body) : pedir('/presupuestos/biblioteca/observaciones', 'POST', body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['presupuestos', 'observaciones'] });
      onCerrar();
    },
  });
  return (
    <Modal abierto titulo={observacion ? 'Editar observación' : 'Nueva observación'} onCerrar={onCerrar}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <Campo etiqueta="Texto">
          <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} required maxLength={500} autoFocus />
        </Campo>
        {texto.includes('{valor}') && (
          <Campo etiqueta="Valor sugerido">
            <Entrada value={valorSugerido} onChange={(e) => setValorSugerido(e.target.value)} maxLength={300} placeholder="120 días hábiles" />
          </Campo>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={porDefecto} onChange={(e) => setPorDefecto(e.target.checked)} />
          Viene tildada en un presupuesto nuevo
        </label>
        <AlertaError error={guardar.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="terciario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
