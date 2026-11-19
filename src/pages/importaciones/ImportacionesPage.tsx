import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertaError,
  Aviso,
  Boton,
  Campo,
  Cargando,
  claseArchivo,
  ContenedorTabla,
  EtiquetaEstado,
  Selector,
  Tarjeta,
  Vacio,
} from '@/components/ui';
import { ESTADOS_IMPORTACION, fechaHora, ORIGENES } from '@/lib/formato';
import { rutaImportacion } from '@/lib/rutas';
import type { Importacion, Paginado, PlantillaMapeo } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

/** Nuevo comprobante → Factura masiva: subir una planilla y el historial de lotes. */
export function CreacionMasiva() {
  const { pedir } = useApi();
  const [pagina, setPagina] = useState(1);
  const { data, error } = useQuery({
    queryKey: ['importaciones', pagina],
    queryFn: () => pedir<Paginado<Importacion>>(`/importaciones?pagina=${pagina}`),
    placeholderData: keepPreviousData,
  });
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <ImportarExcel />
      </div>
      <Tarjeta titulo="Historial">
        {error ? (
          <AlertaError error={error} />
        ) : !data ? (
          <Cargando />
        ) : data.items.length === 0 ? (
          <Vacio>Todavía no importaste nada.</Vacio>
        ) : (
          <>
            <ContenedorTabla>
              <table className="fk-tabla">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Fecha</th>
                    <th className="fk-num">Ítems</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <Link to={rutaImportacion(i.id)}className="font-medium text-fk-fiordo underline-offset-2 hover:underline">
                          {i.descripcion || ORIGENES[i.origen]}
                        </Link>
                        <span className="block text-xs text-fk-gris-texto">{ORIGENES[i.origen]}</span>
                      </td>
                      <td className="whitespace-nowrap tabular-nums">{fechaHora(i.createdAt)}</td>
                      <td className="fk-num text-[13px]">
                        <span className="text-fk-ok-texto">{i.validos} listos</span>
                        {i.conErrores > 0 && <span className="ml-3 text-fk-error-texto">{i.conErrores} con errores</span>}
                        {i.duplicados > 0 && <span className="ml-3 text-fk-gris-texto">{i.duplicados} repetidos</span>}
                      </td>
                      <td>
                        <EtiquetaEstado estado={ESTADOS_IMPORTACION[i.estado]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ContenedorTabla>
            {paginas > 1 && (
              <div className="mt-5 flex items-center justify-end gap-3 text-sm">
                <Boton variante="terciario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Boton>
                <span className="text-fk-gris-texto tabular-nums">
                  Página {pagina} de {paginas}
                </span>
                <Boton variante="terciario" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </Boton>
              </div>
            )}
          </>
        )}
      </Tarjeta>
    </div>
  );
}

function ImportarExcel() {
  const { pedir, subir } = useApi();
  const navigate = useNavigate();
  const plantillas = useQuery({ queryKey: ['plantillas-mapeo'], queryFn: () => pedir<PlantillaMapeo[]>('/configuracion/plantillas-mapeo') });
  const activas = (plantillas.data ?? []).filter((p) => p.activa);
  const [plantillaId, setPlantillaId] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const elegida = plantillaId || activas[0]?.id || '';

  const importar = useMutation({
    mutationFn: (f: File) => subir<Importacion>('/importaciones/excel', 'archivo', f, { method: 'POST', campos: { plantillaMapeoId: elegida } }),
    onSuccess: (imp) => navigate(rutaImportacion(imp.id)),
  });

  function elegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    setArchivo(e.target.files?.[0] ?? null);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (archivo) importar.mutate(archivo);
  }

  if (plantillas.data && activas.length === 0) {
    return (
      <Tarjeta titulo="Planilla Excel / CSV">
        <Aviso tono="azul">
          Primero armá una plantilla que diga qué columna es cada dato, en{' '}
          <Link to="/configuracion?tab=mapeo" className="font-medium underline underline-offset-2">
            Configuración → Plantillas Excel
          </Link>
          .
        </Aviso>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Planilla Excel / CSV">
      <form onSubmit={enviar} className="space-y-5">
        <Campo etiqueta="Plantilla">
          <Selector value={elegida} onChange={(e) => setPlantillaId(e.target.value)}>
            {activas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.formato.toUpperCase()})
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Archivo" ayuda=".xlsx o .csv, hasta 5 MB. El formato .xls viejo no está soportado.">
          <input type="file" accept=".xlsx,.csv,.txt" onChange={elegirArchivo} className={claseArchivo} required />
        </Campo>
        <AlertaError error={importar.error ?? plantillas.error} />
        <div className="flex justify-end">
          <Boton type="submit" cargando={importar.isPending} disabled={!archivo || !elegida}>
            Importar planilla
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
