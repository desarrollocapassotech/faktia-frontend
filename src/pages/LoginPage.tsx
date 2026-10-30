import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type OpcionTenant } from '@/auth/auth-context';
import { ApiError } from '@/lib/api';

/** Solo se vuelve a rutas internas (evita redirecciones abiertas). */
function destinoSeguro(desde: unknown): string {
  return typeof desde === 'string' && desde.startsWith('/') && !desde.startsWith('//') ? desde : '/';
}

export function LoginPage() {
  const { estado, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = destinoSeguro((location.state as { desde?: unknown } | null)?.desde);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [tenants, setTenants] = useState<OpcionTenant[] | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (estado === 'autenticado') return <Navigate to={destino} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await login(email, password, tenants ? tenantSlug : undefined);
      if (res.ok) {
        navigate(destino, { replace: true });
      } else {
        setTenants(res.elegirTenant);
        setTenantSlug(res.elegirTenant[0]?.slug ?? '');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  function cambiarCredenciales() {
    setTenants(null);
    setTenantSlug('');
  }

  const inputClase =
    'h-10 w-full border border-white/15 bg-white px-3 text-sm text-carbon outline-none focus:ring-2 focus:ring-marca/60 disabled:bg-white/70';
  const etiquetaClase = 'text-[10px] uppercase tracking-[0.22em] text-white/70';

  return (
    <main className="flex min-h-screen items-center justify-center bg-carbon px-4">
      <div className="w-full max-w-md border border-white/10 bg-grafito p-6 shadow-xl">
        <h1 className="text-center font-[family-name:var(--font-display)] text-2xl tracking-wide text-white">Facturador</h1>
        <p className="mt-3 text-center text-sm text-white/60">Ingresá con tu email y contraseña.</p>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="email" className={etiquetaClase}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              disabled={tenants !== null}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClase}
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="password" className={etiquetaClase}>
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                disabled={tenants !== null}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClase} pr-10`}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                disabled={tenants !== null}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verPassword}
                title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-acero hover:text-carbon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/40 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {verPassword && <path d="M3 3l18 18" />}
                </svg>
              </button>
            </div>
          </div>

          {tenants && (
            <fieldset className="space-y-2">
              <legend className={`${etiquetaClase} mb-1`}>¿Con qué empresa querés ingresar?</legend>
              {tenants.map((t) => (
                <label key={t.slug} className="flex items-center gap-2 text-sm text-white/90 accent-marca">
                  <input
                    type="radio"
                    name="tenant"
                    value={t.slug}
                    checked={tenantSlug === t.slug}
                    onChange={() => setTenantSlug(t.slug)}
                  />
                  {t.nombre}
                </label>
              ))}
              <button type="button" onClick={cambiarCredenciales} className="text-xs text-marca-suave hover:text-white">
                Usar otro email
              </button>
            </fieldset>
          )}

          {error && (
            <p role="alert" className="border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="h-10 w-full bg-marca text-sm uppercase tracking-wider text-white hover:bg-marca-claro disabled:opacity-60"
          >
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
