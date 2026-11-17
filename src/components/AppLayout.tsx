import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type MouseEvent as EventoMouse } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FileSpreadsheet,
  HandCoins,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { Aviso, Etiqueta } from './ui';

type ItemNav = { a: string; texto: string; icono: LucideIcon; secundario?: boolean };

const NAV: ItemNav[] = [
  { a: '/comprobantes', texto: 'Comprobantes', icono: Receipt },
  { a: '/importaciones', texto: 'Importaciones', icono: FileSpreadsheet },
  { a: '/recibos', texto: 'Recibos', icono: HandCoins },
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

  const nombreCuenta = usuario?.nombre?.trim() || usuario?.email || 'Cuenta';
  const inicial = nombreCuenta.charAt(0).toUpperCase() || 'U';
  const enPruebas = tenant?.ambienteArca === 'HOMOLOGACION';
  // Empresa recién registrada: en Configuración ya está el formulario, ahí el aviso sobra.
  const faltanDatosFiscales = tenant?.datosFiscalesCompletos === false && !location.pathname.startsWith('/configuracion');

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
        <div className="border-t border-fk-blanco-roto/15 px-3 pt-4 text-sm">
          <p className="truncate font-medium">{nombreCuenta}</p>
          {tenant && <p className="truncate text-fk-blanco-roto/75">{tenant.nombre}</p>}
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
        <div className={`border-b border-fk-borde ${enPruebas ? '' : 'hidden lg:block'}`}>
          <div className="mx-auto flex min-h-12 w-full max-w-[var(--fk-ancho-contenido)] items-center gap-3 px-4 py-2 md:px-8 lg:min-h-16 lg:px-10">
            {enPruebas && <Etiqueta tono="pendiente">Ambiente de pruebas</Etiqueta>}
            <div className="flex-1" />
            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fk-niebla text-[13px] font-semibold text-fk-fiordo" aria-hidden>
                {inicial}
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="max-w-[14rem] truncate text-sm font-medium text-fk-grafito">{nombreCuenta}</span>
                {usuario?.nombre && usuario.email && <span className="max-w-[14rem] truncate text-xs text-fk-gris-texto">{usuario.email}</span>}
              </div>
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
                <Link to="/configuracion" className="font-semibold text-fk-fiordo underline underline-offset-2">
                  Completar ahora
                </Link>
              </Aviso>
            </div>
          )}
          <Outlet />
        </main>
      </div>

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
