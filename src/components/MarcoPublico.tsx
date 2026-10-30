import type { ReactNode } from 'react';

/** Pantallas sin sesión (login, acceso por enlace): fondo fiordo y una card blanca centrada con el logo. */
export function MarcoPublico({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fk-fiordo px-4 py-12">
      <div className="w-full max-w-sm rounded-fk bg-fk-blanco px-6 py-10 sm:px-10">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <img src="/brand/faktia-horizontal.svg" alt="Faktia" className="h-10 w-auto" />
          <p className="text-sm text-fk-gris-texto">Facturar no debería ser un trámite.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
