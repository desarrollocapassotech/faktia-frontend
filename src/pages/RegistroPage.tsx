import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { MarcoPublico } from '@/components/MarcoPublico';
import { AlertaError, Boton, Campo, Entrada, EntradaPassword } from '@/components/ui';
import { ApiError } from '@/lib/api';

const PASSWORD_MINIMO = 10;

/**
 * Alta por autoservicio: empresa nueva con su primer usuario. Lo mínimo para entrar;
 * los datos fiscales se piden después, en Configuración, antes de la primera factura.
 */
export function RegistroPage() {
  const { estado, registrar } = useAuth();
  const navigate = useNavigate();

  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Si se registró recién, onSubmit ya navega a Configuración; esto cubre entrar a /registro con sesión.
  if (estado === 'autenticado' && !enviando) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MINIMO) {
      setError(`La contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres.`);
      return;
    }
    setEnviando(true);
    try {
      await registrar({ nombreEmpresa: nombreEmpresa.trim(), email: email.trim(), password });
      navigate('/configuracion', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta.');
      setEnviando(false);
    }
  }

  return (
    <MarcoPublico>
      <form onSubmit={onSubmit} className="grid gap-5">
        <Campo etiqueta="Nombre de tu empresa">
          <Entrada autoComplete="organization" required maxLength={120} value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} />
        </Campo>

        <Campo etiqueta="Email">
          <Entrada type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>

        <Campo etiqueta="Contraseña" ayuda={`Mínimo ${PASSWORD_MINIMO} caracteres.`}>
          <EntradaPassword
            autoComplete="new-password"
            required
            minLength={PASSWORD_MINIMO}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Campo>

        <AlertaError mensaje={error} />

        <Boton type="submit" cargando={enviando} className="w-full">
          {enviando ? 'Creando tu cuenta…' : 'Crear cuenta'}
        </Boton>

        <p className="text-center text-sm text-fk-gris-texto">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-semibold text-fk-fiordo underline-offset-2 hover:underline">
            Ingresá
          </Link>
        </p>
      </form>
    </MarcoPublico>
  );
}
