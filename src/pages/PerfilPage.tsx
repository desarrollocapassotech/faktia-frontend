import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { AlertaError, Aviso, Boton, Campo, EncabezadoPagina, Entrada, EntradaPassword, Tarjeta } from '@/components/ui';

export function PerfilPage() {
  return (
    <div className="space-y-8">
      <EncabezadoPagina titulo="Mi perfil" tituloEnBarra />
      <div className="max-w-[var(--fk-ancho-formulario)] space-y-6">
        <DatosPersonales />
        <CambiarPassword />
      </div>
    </div>
  );
}

function DatosPersonales() {
  const { usuario, tenant, actualizarNombre } = useAuth();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [guardado, setGuardado] = useState(false);

  const guardar = useMutation({
    mutationFn: () => actualizarNombre(nombre.trim()),
    onSuccess: () => setGuardado(true),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Tarjeta titulo="Datos personales">
      <form onSubmit={enviar} className="space-y-5">
        <Campo etiqueta="Nombre" ayuda="Se muestra en la barra de arriba, con tus iniciales.">
          <Entrada
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setGuardado(false);
            }}
            maxLength={120}
            autoComplete="name"
            placeholder="Tu nombre y apellido"
          />
        </Campo>
        <Campo etiqueta="Email" ayuda="Con este email entrás a Faktia. Por ahora no se puede cambiar.">
          <Entrada value={usuario?.email ?? ''} disabled />
        </Campo>
        <Campo
          etiqueta="Empresa"
          ayuda={
            <>
              Los datos de la empresa se editan en{' '}
              <Link to="/configuracion" className="font-semibold text-fk-fiordo underline underline-offset-2">
                Configuración
              </Link>
              .
            </>
          }
        >
          <Entrada value={tenant?.nombre ?? ''} disabled />
        </Campo>
        <AlertaError error={guardar.error} />
        {guardado && <Aviso tono="verde">Datos guardados.</Aviso>}
        <div className="flex justify-end">
          <Boton type="submit" cargando={guardar.isPending} disabled={nombre.trim() === (usuario?.nombre ?? '')}>
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function CambiarPassword() {
  const { usuario, cambiarPassword } = useAuth();
  // Los usuarios que vinieron de una integración no tienen contraseña: la crean sin pedir la actual.
  const tienePassword = usuario?.tienePassword !== false;
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [listo, setListo] = useState(false);

  const noCoinciden = repetida.length > 0 && nueva !== repetida;

  const cambiar = useMutation({
    mutationFn: () => cambiarPassword({ ...(tienePassword ? { passwordActual: actual } : {}), passwordNueva: nueva }),
    onSuccess: () => {
      setActual('');
      setNueva('');
      setRepetida('');
      setListo(true);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (nueva !== repetida) return;
    cambiar.mutate();
  }

  function limpiarAviso() {
    setListo(false);
  }

  return (
    <Tarjeta titulo={tienePassword ? 'Cambiar contraseña' : 'Crear contraseña'}>
      <form onSubmit={enviar} className="space-y-5">
        {!tienePassword && (
          <Aviso tono="azul">Entraste desde otro sistema. Creá una contraseña si querés entrar también con tu email.</Aviso>
        )}
        {tienePassword && (
          <Campo etiqueta="Contraseña actual">
            <EntradaPassword
              value={actual}
              onChange={(e) => {
                setActual(e.target.value);
                limpiarAviso();
              }}
              required
              autoComplete="current-password"
            />
          </Campo>
        )}
        <Campo etiqueta="Contraseña nueva" ayuda="Al menos 10 caracteres.">
          <EntradaPassword
            value={nueva}
            onChange={(e) => {
              setNueva(e.target.value);
              limpiarAviso();
            }}
            required
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
          />
        </Campo>
        <Campo etiqueta="Repetí la contraseña nueva" error={noCoinciden ? 'Las contraseñas no coinciden.' : null}>
          <EntradaPassword
            value={repetida}
            onChange={(e) => {
              setRepetida(e.target.value);
              limpiarAviso();
            }}
            required
            maxLength={72}
            autoComplete="new-password"
            aria-invalid={noCoinciden}
          />
        </Campo>
        <AlertaError error={cambiar.error} />
        {listo && <Aviso tono="verde">Contraseña actualizada. Cerramos tus sesiones en otros dispositivos.</Aviso>}
        <div className="flex justify-end">
          <Boton type="submit" cargando={cambiar.isPending} disabled={noCoinciden}>
            {tienePassword ? 'Cambiar contraseña' : 'Crear contraseña'}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
