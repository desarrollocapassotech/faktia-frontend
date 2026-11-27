import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { ApiError } from './lib/api';
import { migrarClavesViejas } from './lib/storage';
import { toast } from './lib/toasts';
import { Toasts } from './components/Toasts';
import './index.css';

// Antes de que el AuthProvider lea la sesión guardada.
migrarClavesViejas();

const queryClient = new QueryClient({
  // Toasts de todas las mutaciones, con los mensajes de su `meta` (ver lib/toasts.ts).
  mutationCache: new MutationCache({
    onSuccess: (_datos, _variables, _resultado, mutacion) => {
      const mensaje = mutacion.meta?.exito;
      if (mensaje) toast.exito(mensaje);
    },
    onError: (error, _variables, _resultado, mutacion) => {
      const titulo = mutacion.meta?.error;
      if (titulo === false) return;
      // 401: la sesión venció y el AuthProvider ya manda al login.
      if (error instanceof ApiError && error.status === 401) return;
      const detalle = error instanceof Error ? error.message : 'Ocurrió un error.';
      if (titulo) toast.error(titulo, detalle);
      else toast.error(detalle);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // No reintentar errores del cliente (4xx): no se van a arreglar solos.
      retry: (intentos, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && intentos < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
        <Toasts />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
