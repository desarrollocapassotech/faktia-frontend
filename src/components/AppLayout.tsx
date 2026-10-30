import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type MouseEvent as EventoMouse } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  HandCoins,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/auth/auth-context';

type ItemNav = { a: string; texto: string; icono: LucideIcon; secundario?: boolean };

const NAV: ItemNav[] = [
  { a: '/comprobantes', texto: 'Comprobantes', icono: Receipt },
  { a: '/importaciones', texto: 'Importaciones', icono: FileSpreadsheet },
  { a: '/recibos', texto: 'Recibos', icono: HandCoins },
  { a: '/clientes', texto: 'Clientes', icono: Users },
  // Secundario: va pegado al fondo del menú, más apagado (como "Ajustes" en Vialto).
  { a: '/configuracion', texto: 'Configuración', icono: Settings, secundario: true },
];

const claseMenuBase =
  'sidebar-scrollbar shrink-0 bg-carbon text-niebla flex flex-col py-6 gap-6 overflow-y-auto transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';
const claseMenuExpandido = 'w-[16rem] max-w-[92vw] px-4';
const claseMenuColapsado = 'w-[4.5rem] px-2';

const claseTooltip =
  'pointer-events-none fixed z-[200] -translate-y-1/2 whitespace-nowrap rounded-md bg-carbon px-3.5 py-2 font-[family-name:var(--font-ui)] text-sm font-medium tracking-wide text-white shadow-lg';

function MarcaLogo() {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-marca" aria-hidden>
      <svg viewBox="0 0 32 32" className="h-9 w-9">
        <path d="M10 8h12v3H13.5v3.5H20v3h-6.5V24H10z" fill="white" />
      </svg>
    </span>
  );
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

  const nombreCuenta = usuario?.nombre?.trim() || usuario?.email || 'Cuenta';
  const inicial = nombreCuenta.charAt(0).toUpperCase() || 'U';

  function renderMenu(conCerrar: boolean, enRiel: boolean) {
    return (
      <>
        {conCerrar && (
          <div className="flex justify-end px-1">
            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              aria-label="Cerrar menú"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 text-white/80 hover:bg-white/10"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        )}

        <nav className={`flex flex-1 flex-col gap-0.5 ${enRiel ? 'items-center' : ''}`}>
          {NAV.map((item, i) => {
            const primerSecundario = item.secundario && !NAV[i - 1]?.secundario;
            return (
              <div key={item.a} className={`flex flex-col ${enRiel ? 'items-center' : ''} ${primerSecundario ? 'mt-auto pt-4' : ''}`}>
                <NavLink
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
                      'flex min-h-11 items-center rounded-md border font-[family-name:var(--font-ui)] text-sm font-medium uppercase tracking-wider transition-colors',
                      enRiel ? 'w-11 justify-center px-0' : 'gap-2.5 px-3 py-2.5',
                      item.secundario
                        ? isActive
                          ? 'border-white/20 bg-white/[0.1] text-white'
                          : 'border-white/[0.06] text-white/60 hover:border-white/15 hover:bg-white/[0.06] hover:text-white'
                        : isActive
                          ? 'border-marca bg-marca text-white shadow-sm'
                          : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                    ].join(' ')
                  }
                >
                  <item.icono className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {!enRiel && <span className="whitespace-nowrap">{item.texto}</span>}
                </NavLink>
              </div>
            );
          })}
        </nav>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-niebla">
      <header className="sticky top-0 z-[1] flex h-16 shrink-0 items-center gap-3 bg-carbon px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10 lg:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <MarcaLogo />
          <div className="inline-flex flex-col justify-center leading-none">
            <span className="block font-[family-name:var(--font-display)] text-lg text-marca-claro [text-align-last:justify] [text-justify:inter-character]">
              FACTURADOR
            </span>
            <span className="-mt-1 block font-[family-name:var(--font-ui)] text-[10px] uppercase text-white [text-align-last:justify] [text-justify:inter-character]">
              Electrónico
            </span>
          </div>

          {tenant && (
            <div className="hidden min-w-0 items-center gap-3 border-l border-white/10 pl-3 sm:flex">
              <span className="max-w-[9rem] truncate font-[family-name:var(--font-ui)] text-xs tracking-wide text-white/45 md:max-w-[14rem]">
                {tenant.nombre}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-2">
          {tenant?.ambienteArca === 'HOMOLOGACION' && (
            <span className="rounded-sm border border-amber-500 bg-amber-400 px-2 py-0.5 font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.15em] text-amber-900">
              Ambiente de pruebas
            </span>
          )}

          <div className="hidden min-w-0 items-center gap-2 pl-1 sm:flex">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/80 ring-2 ring-white/20">
              {inicial}
            </div>
            <div className="flex min-w-0 flex-col justify-center leading-none">
              <span className="max-w-[9rem] truncate text-sm text-white/90">{nombreCuenta}</span>
              {usuario?.nombre && usuario.email && (
                <span className="-mt-0.5 max-w-[9rem] truncate font-[family-name:var(--font-ui)] text-[10px] tracking-wide text-white/45">
                  {usuario.email}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={salir}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/85 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {menuAbierto && (
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-x-0 top-16 bottom-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        <div ref={menuDesktopRef} className="sidebar-control-zone fixed top-16 left-0 z-30 hidden h-[calc(100dvh-4rem)] lg:block">
          <aside className={['flex h-full', claseMenuBase, colapsado ? claseMenuColapsado : claseMenuExpandido].join(' ')}>
            {renderMenu(false, colapsado)}
          </aside>
          <button
            type="button"
            onClick={() => {
              setColapsado((c) => !c);
              setTooltip(null);
            }}
            aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
            onMouseEnter={(e) => mostrarTooltip(e, colapsado ? 'Expandir menú' : 'Colapsar menú')}
            onMouseLeave={() => setTooltip(null)}
            className="sidebar-expand-button group absolute top-1/2 -right-3 z-10 -mt-6 inline-flex h-12 w-7 cursor-pointer items-center justify-center rounded-r-lg border border-l-0 border-white/20 bg-marca text-white shadow-lg transition-[background-color,box-shadow,transform] duration-300 ease-out hover:bg-marca/90 hover:shadow-xl hover:brightness-110 active:scale-95"
          >
            {colapsado ? (
              <ChevronRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" strokeWidth={2.25} />
            ) : (
              <ChevronLeft className="h-4 w-4 transition-transform duration-300 ease-out group-hover:-translate-x-0.5" strokeWidth={2.25} />
            )}
          </button>
        </div>

        <aside
          aria-hidden={!menuAbierto}
          className={[
            claseMenuBase,
            claseMenuExpandido,
            'fixed top-16 bottom-0 left-0 z-50 transition-transform duration-200 ease-in-out lg:hidden',
            menuAbierto ? 'translate-x-0' : 'pointer-events-none -translate-x-full',
          ].join(' ')}
        >
          {renderMenu(true, false)}
        </aside>

        <div
          className={[
            'flex min-w-0 flex-1 flex-col transition-[margin-left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            colapsado ? 'lg:ml-[4.5rem]' : 'lg:ml-[16rem]',
          ].join(' ')}
        >
          <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
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
