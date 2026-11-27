import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type OpcionTenant } from '@/auth/auth-context';
import { MarcoIngreso } from '@/components/MarcoIngreso';
import { AlertaError, Boton, Campo, Entrada, EntradaPassword } from '@/components/ui';
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

  return (
    <MarcoIngreso titulo="Ingresá a tu cuenta" bajada={tenants ? 'Tu email está en más de una empresa: elegí con cuál entrar.' : 'Con el email y la contraseña de tu cuenta.'}>
      <form onSubmit={onSubmit} className="grid gap-5">
        <Campo etiqueta="Email">
          <Entrada
            type="email"
            autoComplete="username"
            required
            value={email}
            disabled={tenants !== null}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Contraseña">
          <EntradaPassword
            autoComplete="current-password"
            required
            value={password}
            disabled={tenants !== null}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Campo>

        {tenants && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-[13px] font-semibold">¿Con qué empresa querés ingresar?</legend>
            {/* Cada empresa como una opción grande, marcada con borde fiordo. */}
            {tenants.map((t) => (
              <label
                key={t.slug}
                className={`flex cursor-pointer items-center gap-3 rounded-fk border px-4 py-3 text-sm transition-colors ${
                  tenantSlug === t.slug ? 'border-fk-fiordo bg-fk-niebla/50 font-semibold text-fk-fiordo' : 'border-fk-borde hover:bg-fk-niebla/40'
                }`}
              >
                <input type="radio" name="tenant" value={t.slug} checked={tenantSlug === t.slug} onChange={() => setTenantSlug(t.slug)} className="accent-fk-fiordo" />
                {t.nombre}
              </label>
            ))}
            <button type="button" onClick={cambiarCredenciales} className="text-sm font-medium text-fk-fiordo underline-offset-2 hover:underline">
              Usar otro email
            </button>
          </fieldset>
        )}

        <AlertaError mensaje={error} />

        <Boton type="submit" cargando={enviando} className="w-full">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Boton>

        <p className="text-center text-sm text-fk-gris-texto">
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="font-semibold text-fk-fiordo underline-offset-2 hover:underline">
            Creá tu cuenta
          </Link>
        </p>
      </form>
    </MarcoIngreso>
  );
}
