import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertaError, Cargando, EncabezadoPagina, Tarjeta } from '@/components/ui';
import type { Cliente } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { FormularioCliente } from './ClienteModal';

/** Alta (`/clientes/nuevo`) o edición (`/clientes/:id/editar`) de un cliente en su propia página. */
export function ClientePage() {
  const { id } = useParams();
  const esNuevo = !id;
  const { pedir } = useApi();
  const navigate = useNavigate();

  const { data: cliente, error } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => pedir<Cliente>(`/clientes/${id}`),
    enabled: !esNuevo,
  });

  const nombre = cliente?.razonSocial ?? 'Cliente';
  const migas = esNuevo
    ? [{ texto: 'Clientes', a: '/clientes' }, { texto: 'Nuevo cliente' }]
    : [{ texto: 'Clientes', a: '/clientes' }, { texto: nombre, a: `/clientes/${id}` }, { texto: 'Editar' }];

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo={esNuevo ? 'Nuevo cliente' : `Editar ${nombre}`} tituloEnBarra migas={migas} />
      {error ? (
        <AlertaError error={error} />
      ) : !esNuevo && !cliente ? (
        <Cargando />
      ) : (
        <Tarjeta className="max-w-[var(--fk-ancho-formulario)]">
          <FormularioCliente
            key={cliente?.id ?? 'nuevo'}
            cliente={cliente}
            onCancelar={() => navigate(esNuevo ? '/clientes' : `/clientes/${id}`)}
            onGuardado={(c) => navigate(`/clientes/${c.id}`)}
          />
        </Tarjeta>
      )}
    </div>
  );
}
