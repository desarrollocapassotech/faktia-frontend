import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { MarcoPublico } from '@/components/MarcoPublico';
import { claseBoton } from '@/components/estilos';
import { AlertaError, Cargando } from '@/components/ui';
import { ApiError } from '@/lib/api';

/** Solo rutas internas (el backend ya valida el destino contra una lista blanca). */
function destinoInterno(d: string | null): string {
  return d && d.startsWith('/') && !d.startsWith('//') ? d : '/';
}

/**
 * Entrada desde otro sistema sin volver a loguearse: /acceso?token=… (ARCHITECTURE.md §8.1).
 * El token se saca de la URL antes de cualquier otra cosa y se canjea una sola vez.
 */
export function AccesoPage() {
  const { canjearAcceso } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const iniciado = useRef(false);

  useEffect(() => {
    // StrictMode monta dos veces en desarrollo: el token es de un solo uso.
    if (iniciado.current) return;
    iniciado.current = true;
    const token = new URLSearchParams(window.location.search).get('token');
    window.history.replaceState(null, '', '/acceso');
    if (!token) {
      setError('El enlace de acceso no es válido.');
      return;
    }
    canjearAcceso(token)
      .then(({ destino }) => {
        queryClient.clear(); // si había otra sesión abierta, no mostrar sus datos
        navigate(destinoInterno(destino), { replace: true });
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo ingresar.'));
  }, [canjearAcceso, navigate, queryClient]);

  return (
    <MarcoPublico>
      {error ? (
        <div className="space-y-5 text-center">
          <AlertaError mensaje={error} />
          <Link to="/login" className={`${claseBoton('terciario')} w-full`}>
            Ingresar con email y contraseña
          </Link>
        </div>
      ) : (
        <Cargando texto="Ingresando…" />
      )}
    </MarcoPublico>
  );
}
