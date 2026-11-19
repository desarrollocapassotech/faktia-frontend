import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type MouseEvent as EventoMouse } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  Receipt,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import type { Certificado } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { Aviso, Boton, Etiqueta, ID_BARRA_MIGAS, Modal } from './ui';

type ItemNav = { a: string; texto: string; icono: LucideIcon; secundario?: boolean };

const NAV: ItemNav[] = [
  { a: '/comprobantes', texto: 'Comprobantes', icono: Receipt },
  { a: '/clientes', texto: 'Clientes', icono: Users },
  // Secundario: va pegado al fondo del menú.
  { a: '/configuracion', texto: 'Configuración', icono: Settings, secundario: true },
];

const claseMenuBase =
  'fk-sobre-oscuro flex shrink-0 flex-col gap-8 overflow-y-auto bg-fk-fiordo py-6 text-fk-blanco-roto transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--fk-blanco-roto)_25%,transparent)_transparent]';
const claseMenuExpandido = 'w-[var(--fk-sidebar)] max-w-[92vw] px-3';
const claseMenuColapsado = 'w-[var(--fk-sidebar-colapsado)] px-3';

// Ítem del menú: texto en blanco roto; el activo lleva una barra terracota de 3 px a la izquierda,
// además de fondo y peso (la barra sola no llega a 3:1 contra el fiordo).
const claseItem = 'relative flex min-h-11 items-center rounded-fk text-[15px] transition-colors';
const claseItemActivo =
  'bg-fk-blanco-roto/10 font-semibold text-fk-blanco-roto before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-fk-terracota';
const claseItemInactivo = 'font-medium text-fk-blanco-roto/80 hover:bg-fk-blanco-roto/5 hover:text-fk-blanco-roto';

const claseBotonIcono =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-fk text-fk-blanco-roto/80 transition-colors hover:bg-fk-blanco-roto/10 hover:text-fk-blanco-roto';

const claseTooltip =
  'pointer-events-none fixed z-[200] -translate-y-1/2 whitespace-nowrap rounded-fk bg-fk-grafito px-3 py-1.5 text-sm font-medium text-fk-blanco';

/**
 * Al ingresar con contraseña, si la empresa todavía no factura en producción: un modal que lo
 * avisa y lleva a cargar el certificado (o antes a completar los datos, si faltan). No aparece al
 * recargar la página ni si ya se está en esa pantalla.
 */
function AvisoConfiguracionPendiente() {
  const { tenant, recienIngresado, ingresoVisto } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const yaEstaAhi = location.pathname.startsWith('/primeros-pasos') || location.search.includes('tab=certificados');
  const abierto = recienIngresado && tenant?.ambienteArca !== 'PRODUCCION' && !yaEstaAhi;

  // Si el ingreso llevó directo a esa pantalla, el aviso ya no hace falta (ni más tarde, al salir de ahí).
  useEffect(() => {
    if (recienIngresado && yaEstaAhi) ingresoVisto();
  }, [recienIngresado, yaEstaAhi, ingresoVisto]);
  const faltanDatos = tenant?.datosFiscalesCompletos === false;

  function ir() {
    ingresoVisto();
    navigate(faltanDatos ? '/primeros-pasos' : '/configuracion?tab=certificados');
  }

  return (
    <Modal abierto={abierto} titulo={faltanDatos ? 'Falta configurar tu empresa' : 'Falta cargar el certificado'} onCerrar={ingresoVisto}>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fk-pendiente-fondo text-fk-pendiente-texto">
          <ShieldAlert className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="text-sm text-fk-gris-texto">
          {faltanDatos
            ? 'Completá los datos de tu empresa y cargá el certificado de ARCA para facturar de verdad.'
            : 'Sin el certificado de ARCA, tus comprobantes salen sin validez fiscal.'}
        </p>
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Boton variante="fantasma" onClick={ingresoVisto}>
            Más tarde
          </Boton>
          <Boton onClick={ir}>{faltanDatos ? 'Completar ahora' : 'Cargar certificado'}</Boton>
        </div>
      </div>
    </Modal>
  );
}

/**
 * En la barra de arriba, mientras la empresa está en pruebas: qué le falta para facturar de verdad
 * (datos fiscales, certificado o activar producción) y un click para resolverlo.
 */
function AdvertenciaPendiente() {
  const { tenant } = useAuth();
  const { pedir } = useApi();
  const faltanDatos = tenant?.datosFiscalesCompletos === false;
  const certificados = useQuery({
    queryKey: ['certificados'],
    queryFn: () => pedir<Certificado[]>('/configuracion/certificados'),
    enabled: !faltanDatos,
  });
  if (!faltanDatos && !certificados.data) return null;

  const tieneCertificado = certificados.data?.some((c) => c.ambiente === 'PRODUCCION') ?? false;
  const { texto, a } = faltanDatos
    ? { texto: 'Faltan los datos fiscales', a: '/primeros-pasos' }
    : tieneCertificado
      ? { texto: 'Falta activar producción', a: '/configuracion?tab=produccion' }
      : { texto: 'Falta el certificado', a: '/configuracion?tab=certificados' };

  return (
    <Link
      to={a}
      title="Tus comprobantes todavía no tienen validez fiscal"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-fk-pendiente-texto/30 bg-fk-pendiente-fondo px-3 text-xs font-semibold text-fk-pendiente-texto transition-colors hover:border-fk-pendiente-texto/60"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="whitespace-nowrap">{texto}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
    </Link>
  );
}

/** "Ana María Pérez" → "AP"; sin nombre, la primera letra del email. */
function inicialesDe(nombre: string | null | undefined, email: string | undefined): string {
  const palabras = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length > 0) {
    const letras = palabras.length === 1 ? palabras[0].charAt(0) : palabras[0].charAt(0) + palabras[palabras.length - 1].charAt(0);
    return letras.toUpperCase();
  }
  return (email?.charAt(0) || 'U').toUpperCase();
}

export function AppLayout() {
  const { usuario, tenant, logout } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [colapsado, setColapsado] = useState(true);
  const [tooltip, setTooltip] = useState<{ texto: string; top: number; left: number } | null>(null);
  const menuDesktopRef = useRef<HTMLDivElement>(null);

  function salir() {
    queryClient.clear(); // no dejar datos de la empresa en memoria para la próxima sesión
    logout();
  }

  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  // Desktop: con el menú expandido, un click fuera de él lo colapsa.
  useEffect(() => {
    if (colapsado) return;
    function onMouseDown(e: MouseEvent) {
      if (menuDesktopRef.current?.contains(e.target as Node)) return;
      setColapsado(true);
      setTooltip(null);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [colapsado]);

  useEffect(() => {
    if (!menuAbierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuAbierto]);

  function mostrarTooltip(e: EventoMouse<HTMLElement>, texto: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ texto, top: rect.top + rect.height / 2, left: rect.right + 10 });
  }

  const iniciales = inicialesDe(usuario?.nombre, usuario?.email);
  const nombreEmpresa = tenant?.nombre ?? 'Mi perfil';
  const enPerfil = location.pathname.startsWith('/perfil');
  const enPruebas = tenant?.ambienteArca === 'HOMOLOGACION';
  // Empresa recién registrada: en Configuración y en Primeros pasos ya está el formulario, ahí el aviso sobra.
  const enConfiguracion = location.pathname.startsWith('/configuracion') || location.pathname.startsWith('/primeros-pasos');
  const faltanDatosFiscales = tenant?.datosFiscalesCompletos === false && !enConfiguracion;

  function renderNav(enRiel: boolean) {
    return (
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
        {NAV.map((item, i) => {
          const primerSecundario = item.secundario && !NAV[i - 1]?.secundario;
          return (
            <NavLink
              key={item.a}
              to={item.a}
              aria-label={enRiel ? item.texto : undefined}
              onMouseEnter={(e) => enRiel && mostrarTooltip(e, item.texto)}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => {
                setMenuAbierto(false);
                setTooltip(null);
              }}
              className={({ isActive }) =>
                [
                  claseItem,
                  enRiel ? 'justify-center px-0' : 'gap-3 px-3',
                  primerSecundario ? 'mt-auto' : '',
                  isActive ? claseItemActivo : claseItemInactivo,
                ].join(' ')
              }
            >
              <item.icono className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
              {!enRiel && <span className="whitespace-nowrap">{item.texto}</span>}
            </NavLink>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-fk-blanco-roto">
      {/* Mobile: barra fiordo con el logo y el menú desplegable. */}
      <header className="fk-sobre-oscuro sticky top-0 z-40 flex h-14 items-center gap-2 bg-fk-fiordo px-2 lg:hidden">
        <button
          type="button"
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          aria-controls="menu-mobile"
          onClick={() => setMenuAbierto((v) => !v)}
          className={claseBotonIcono}
        >
          {menuAbierto ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
        </button>
        <img src="/brand/faktia-horizontal-negativo.svg" alt="Faktia" className="h-7 w-auto" />
        <div className="flex-1" />
        <button type="button" onClick={salir} aria-label="Cerrar sesión" title="Cerrar sesión" className={claseBotonIcono}>
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </header>

      {menuAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={-1}
          className="fixed inset-x-0 top-14 bottom-0 z-30 bg-fk-grafito/40 lg:hidden"
          onClick={() => setMenuAbierto(false)}
        />
      )}
      <aside
        id="menu-mobile"
        aria-hidden={!menuAbierto}
        inert={!menuAbierto}
        className={[
          claseMenuBase,
          claseMenuExpandido,
          'fixed top-14 bottom-0 left-0 z-40 transition-transform duration-200 ease-out lg:hidden',
          menuAbierto ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {renderNav(false)}
        <div className="border-t border-fk-blanco-roto/15 pt-4">
          <Link
            to="/perfil"
            aria-label={`Mi perfil — ${nombreEmpresa}`}
            className={`${claseItem} gap-3 px-3 ${enPerfil ? claseItemActivo : claseItemInactivo}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fk-blanco-roto/15 text-[13px] font-semibold" aria-hidden>
              {iniciales}
            </span>
            <span className="truncate">{nombreEmpresa}</span>
          </Link>
        </div>
      </aside>

      {/* Desktop: sidebar fiordo a toda la altura, con el logo arriba. */}
      <div ref={menuDesktopRef} className="fixed inset-y-0 left-0 z-30 hidden lg:flex">
        <aside className={['h-full', claseMenuBase, colapsado ? claseMenuColapsado : claseMenuExpandido].join(' ')}>
          <div className={`flex h-10 items-center ${colapsado ? 'justify-center' : 'px-3'}`}>
            {colapsado ? (
              <img src="/brand/faktia-icono-negativo.svg" alt="Faktia" className="h-8 w-8" />
            ) : (
              <img src="/brand/faktia-horizontal-negativo.svg" alt="Faktia" className="h-8 w-auto" />
            )}
          </div>
          {renderNav(colapsado)}
          <button
            type="button"
            onClick={() => {
              setColapsado((c) => !c);
              setTooltip(null);
            }}
            aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
            aria-expanded={!colapsado}
            onMouseEnter={(e) => colapsado && mostrarTooltip(e, 'Expandir menú')}
            onMouseLeave={() => setTooltip(null)}
            className={`${claseItem} ${claseItemInactivo} ${colapsado ? 'justify-center px-0' : 'gap-3 px-3'}`}
          >
            {colapsado ? (
              <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="whitespace-nowrap">Colapsar</span>
              </>
            )}
          </button>
        </aside>
      </div>

      <div
        className={[
          'flex min-w-0 flex-col transition-[padding-left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          colapsado ? 'lg:pl-[var(--fk-sidebar-colapsado)]' : 'lg:pl-[var(--fk-sidebar)]',
        ].join(' ')}
      >
        {/* Barra de cuenta: ambiente y usuario, sobre el fondo de la app. En mobile solo aparece si hay que avisar el ambiente. */}
        <div className={`border-b border-fk-borde ${enPruebas ? '' : 'hidden has-[nav]:block lg:block'}`}>
          <div className="mx-auto flex min-h-12 w-full max-w-[var(--fk-ancho-contenido)] items-center gap-3 px-4 py-2 md:px-8 lg:min-h-16 lg:px-10">
            {/* Migas de la página actual (las pone EncabezadoPagina con un portal). */}
            <div id={ID_BARRA_MIGAS} className="min-w-0 empty:hidden" />
            {enPruebas && (
              // Lleva a terminar la configuración (certificado y paso a producción).
              <Link to="/primeros-pasos" title="Terminar la configuración para facturar de verdad" className="rounded-full hover:opacity-80">
                <Etiqueta tono="pendiente">Ambiente de pruebas</Etiqueta>
              </Link>
            )}
            <div className="flex-1" />
            {enPruebas && <AdvertenciaPendiente />}
            <div className="hidden min-w-0 items-center gap-1 lg:flex">
              <Link
                to="/perfil"
                aria-label={`Mi perfil — ${nombreEmpresa}`}
                title="Mi perfil"
                aria-current={enPerfil ? 'page' : undefined}
                className={`flex min-h-10 min-w-0 items-center gap-3 rounded-fk py-1 pr-3 pl-1 transition-colors hover:bg-fk-niebla ${enPerfil ? 'bg-fk-niebla' : ''}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fk-niebla text-[13px] font-semibold text-fk-fiordo" aria-hidden>
                  {iniciales}
                </span>
                <span className="max-w-[14rem] truncate text-sm font-medium text-fk-grafito">{nombreEmpresa}</span>
              </Link>
              <button
                type="button"
                onClick={salir}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-fk text-fk-gris-texto transition-colors hover:bg-fk-niebla hover:text-fk-fiordo"
              >
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-[var(--fk-ancho-contenido)] min-w-0 flex-1 px-4 pt-5 pb-8 md:px-8 lg:px-10 lg:pt-6 lg:pb-10">
          {faltanDatosFiscales && (
            <div className="mb-5">
              <Aviso tono="azul">
                Para empezar a facturar, completá los datos fiscales de tu empresa.{' '}
                <Link to="/primeros-pasos" className="font-semibold text-fk-fiordo underline underline-offset-2">
                  Completar ahora
                </Link>
              </Aviso>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <AvisoConfiguracionPendiente />

      {tooltip &&
        createPortal(
          <div className={claseTooltip} style={{ top: tooltip.top, left: tooltip.left }}>
            {tooltip.texto}
          </div>,
          document.body,
        )}
    </div>
  );
}
