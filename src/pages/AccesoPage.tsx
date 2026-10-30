import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
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
    <main className="flex min-h-screen items-center justify-center bg-carbon px-4">
      <div className="w-full max-w-md border border-white/10 bg-grafito p-6 text-center shadow-xl">
        <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide text-white">Facturador</h1>
        {error ? (
          <div className="space-y-4">
            <p role="alert" className="border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
            <Link to="/login" className="text-sm text-marca-suave hover:text-white">
              Ingresar con email y contraseña
            </Link>
          </div>
        ) : (
          <p className="text-sm text-white/60">Ingresando…</p>
        )}
      </div>
    </main>
  );
}
