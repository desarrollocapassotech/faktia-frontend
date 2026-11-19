import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { PrimerosPasosPage } from './pages/PrimerosPasosPage';
import { AppLayout } from './components/AppLayout';
import { ClientesPage } from './pages/clientes/ClientesPage';
import { ComprobanteDetallePage } from './pages/comprobantes/ComprobanteDetallePage';
import { ComprobantesPage } from './pages/comprobantes/ComprobantesPage';
import { NuevoComprobantePage } from './pages/comprobantes/NuevoComprobantePage';
import { AccesoPage } from './pages/AccesoPage';
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage';
import { ImportacionDetallePage } from './pages/importaciones/ImportacionDetallePage';
import { RUTA_CREACION_MASIVA, RUTA_RECIBO, rutaImportacion } from './lib/rutas';
import { LoginPage } from './pages/LoginPage';
import { PerfilPage } from './pages/PerfilPage';
import { RegistroPage } from './pages/RegistroPage';

function RedirigirImportacion() {
  const { id = '' } = useParams();
  return <Navigate to={rutaImportacion(id)} replace />;
}

/** Al entrar (el login lleva a "/"): si la empresa no terminó de configurarse, lo primero es eso. */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/acceso" element={<AccesoPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {/* Si falta configurar, AppLayout lo avisa con un modal al ingresar. */}
        <Route index element={<Navigate to="/comprobantes" replace />} />
        <Route path="primeros-pasos" element={<PrimerosPasosPage />} />
        <Route path="comprobantes" element={<ComprobantesPage />} />
        <Route path="comprobantes/nuevo" element={<NuevoComprobantePage />} />
        <Route path="comprobantes/importaciones/:id" element={<ImportacionDetallePage />} />
        <Route path="comprobantes/:id" element={<ComprobanteDetallePage />} />
        {/* Importaciones y Recibos pasaron a Nuevo comprobante (Factura masiva / Recibo): las URLs viejas redirigen. */}
        <Route path="importaciones" element={<Navigate to={RUTA_CREACION_MASIVA} replace />} />
        <Route path="importaciones/:id" element={<RedirigirImportacion />} />
        <Route path="recibos" element={<Navigate to={RUTA_RECIBO} replace />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
        <Route path="perfil" element={<PerfilPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
