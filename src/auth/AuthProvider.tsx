import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, registrarOnNoAutorizado } from '@/lib/api';
import { borrar, guardar, leer } from '@/lib/storage';
import { AuthContext, type AuthState, type OpcionTenant, type TenantSesion, type Usuario } from './auth-context';

const CLAVE_TOKEN = 'faktia.sesion';
/**
 * Último perfil confirmado (usuario y empresa, sin secretos). Con él, al refrescar la página la app
 * arranca enseguida y la sesión se valida en segundo plano: así se ve un solo loader (el de la
 * pantalla) y no uno a pantalla completa antes. Si la sesión no es válida, se cierra igual.
 */
const CLAVE_PERFIL = 'faktia.perfil';

function leerPerfil(): PerfilResponse | null {
  try {
    const v = JSON.parse(leer(CLAVE_PERFIL) ?? 'null') as PerfilResponse | null;
    return v?.usuario && v?.tenant ? v : null;
  } catch {
    return null;
  }
}

interface SesionResponse {
  accessToken: string;
  usuario: Usuario;
  tenant: TenantSesion;
}

interface PerfilResponse {
  usuario: Usuario;
  tenant: TenantSesion;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const tokenRef = useRef<string | null>(leer(CLAVE_TOKEN));
  const perfilInicial = useRef(tokenRef.current ? leerPerfil() : null).current;
  const [estado, setEstado] = useState<AuthState['estado']>(tokenRef.current ? (perfilInicial ? 'autenticado' : 'cargando') : 'anonimo');
  const [usuario, setUsuario] = useState<Usuario | null>(perfilInicial?.usuario ?? null);
  const [tenant, setTenant] = useState<TenantSesion | null>(perfilInicial?.tenant ?? null);
  const [recienIngresado, setRecienIngresado] = useState(false);
  const ingresoVisto = useCallback(() => setRecienIngresado(false), []);

  /** Aplica un perfil confirmado por el backend y lo recuerda para el próximo arranque. */
  const aplicarPerfil = useCallback((perfil: PerfilResponse) => {
    setUsuario(perfil.usuario);
    setTenant(perfil.tenant);
    guardar(CLAVE_PERFIL, JSON.stringify({ usuario: perfil.usuario, tenant: perfil.tenant }));
  }, []);

  const logout = useCallback(() => {
    tokenRef.current = null;
    borrar(CLAVE_TOKEN);
    borrar(CLAVE_PERFIL);
    setUsuario(null);
    setTenant(null);
    setEstado('anonimo');
  }, []);

  // Sesión vencida o revocada en cualquier request → volver al login.
  useEffect(() => {
    registrarOnNoAutorizado(logout);
    return () => registrarOnNoAutorizado(null);
  }, [logout]);

  // Al abrir la app con un token guardado, confirmar que sigue siendo válido.
  useEffect(() => {
    const token = tokenRef.current;
    if (!token) return;
    const controller = new AbortController();
    api<PerfilResponse>('/auth/me', { token, signal: controller.signal })
      .then((perfil) => {
        aplicarPerfil(perfil);
        setEstado('autenticado');
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        // Sin conexión, con un perfil guardado se sigue: las pantallas muestran su propio error.
        if (err instanceof ApiError && err.status === 0 && perfilInicial) return;
        logout();
      });
    return () => controller.abort();
  }, [logout, aplicarPerfil, perfilInicial]);

  const abrirSesion = useCallback(async (accessToken: string) => {
    tokenRef.current = accessToken;
    guardar(CLAVE_TOKEN, accessToken);
    const perfil = await api<PerfilResponse>('/auth/me', { token: accessToken });
    aplicarPerfil(perfil);
    setEstado('autenticado');
  }, [aplicarPerfil]);

  const login = useCallback<AuthState['login']>(async (email, password, tenantSlug) => {
    try {
      const sesion = await api<SesionResponse>('/auth/login', {
        method: 'POST',
        body: { email, password, ...(tenantSlug ? { tenantSlug } : {}) },
      });
      await abrirSesion(sesion.accessToken);
      setRecienIngresado(true);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const tenants = (err.body as { tenants?: OpcionTenant[] } | null)?.tenants ?? [];
        return { ok: false, elegirTenant: tenants };
      }
      throw err;
    }
  }, [abrirSesion]);

  const registrar = useCallback<AuthState['registrar']>(
    async (datos) => {
      const sesion = await api<SesionResponse>('/auth/registro', { method: 'POST', body: datos });
      await abrirSesion(sesion.accessToken);
    },
    [abrirSesion],
  );

  const refrescarPerfil = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    const perfil = await api<PerfilResponse>('/auth/me', { token });
    aplicarPerfil(perfil);
  }, [aplicarPerfil]);

  const actualizarNombre = useCallback<AuthState['actualizarNombre']>(async (nombre) => {
    const token = tokenRef.current;
    if (!token) return;
    const perfil = await api<PerfilResponse>('/auth/me', { method: 'PATCH', token, body: { nombre } });
    aplicarPerfil(perfil);
  }, [aplicarPerfil]);

  const cambiarPassword = useCallback<AuthState['cambiarPassword']>(
    async (datos) => {
      const token = tokenRef.current;
      if (!token) return;
      // El backend revoca las sesiones anteriores (incluida esta) y devuelve una nueva.
      const sesion = await api<SesionResponse>('/auth/password', { method: 'POST', token, body: datos });
      await abrirSesion(sesion.accessToken);
    },
    [abrirSesion],
  );

  /** Entrada sin contraseña desde un sistema integrado (token de un solo uso). */
  const canjearAcceso = useCallback<AuthState['canjearAcceso']>(
    async (token) => {
      const sesion = await api<SesionResponse & { destino: string | null }>('/auth/acceso/canjear', {
        method: 'POST',
        body: { token },
      });
      await abrirSesion(sesion.accessToken);
      return { destino: sesion.destino };
    },
    [abrirSesion],
  );

  const valor = useMemo<AuthState>(
    () => ({
      estado,
      usuario,
      tenant,
      getToken: () => tokenRef.current,
      login,
      registrar,
      refrescarPerfil,
      actualizarNombre,
      cambiarPassword,
      canjearAcceso,
      logout,
      recienIngresado,
      ingresoVisto,
    }),
    [estado, usuario, tenant, login, registrar, refrescarPerfil, actualizarNombre, cambiarPassword, canjearAcceso, logout, recienIngresado, ingresoVisto],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
