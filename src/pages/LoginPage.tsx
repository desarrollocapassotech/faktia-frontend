import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth, type OpcionTenant } from '@/auth/auth-context';
import { MarcoPublico } from '@/components/MarcoPublico';
import { AlertaError, Boton, Campo, Entrada } from '@/components/ui';
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

  return (
    <MarcoPublico>
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
          <span className="relative block">
            <Entrada
              type={verPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              disabled={tenants !== null}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              disabled={tenants !== null}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={verPassword}
              title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-fk text-fk-gris-texto hover:text-fk-fiordo disabled:opacity-50"
            >
              {verPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            </button>
          </span>
        </Campo>

        {tenants && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-[13px] font-semibold">¿Con qué empresa querés ingresar?</legend>
            {tenants.map((t) => (
              <label key={t.slug} className="flex items-center gap-2 text-sm">
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
            <button type="button" onClick={cambiarCredenciales} className="text-sm font-medium text-fk-fiordo underline-offset-2 hover:underline">
              Usar otro email
            </button>
          </fieldset>
        )}

        <AlertaError mensaje={error} />

        <Boton type="submit" cargando={enviando} className="w-full">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Boton>
      </form>
    </MarcoPublico>
  );
}
