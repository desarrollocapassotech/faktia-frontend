import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { PrimerosPasosPage } from './pages/PrimerosPasosPage';
import { AppLayout } from './components/AppLayout';
import { ClienteDetallePage } from './pages/clientes/ClienteDetallePage';
import { ClientePage } from './pages/clientes/ClientePage';
import { ClientesPage } from './pages/clientes/ClientesPage';
import { ComprobanteDetallePage } from './pages/comprobantes/ComprobanteDetallePage';
import { ComprobantesPage } from './pages/comprobantes/ComprobantesPage';
import { NuevoComprobantePage } from './pages/comprobantes/NuevoComprobantePage';
import { AccesoPage } from './pages/AccesoPage';
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage';
import { CuentaClientePage } from './pages/cuenta-corriente/CuentaClientePage';
import { CuentaCorrientePage } from './pages/cuenta-corriente/CuentaCorrientePage';
import { ImportacionDetallePage } from './pages/importaciones/ImportacionDetallePage';
import { RUTA_CREACION_MASIVA, RUTA_RECIBO, rutaImportacion } from './lib/rutas';
import { LoginPage } from './pages/LoginPage';
import { PerfilPage } from './pages/PerfilPage';
import { NuevoProyectoPage } from './pages/proyectos/NuevoProyectoPage';
import { BibliotecaPage } from './pages/presupuestos/BibliotecaPage';
import { PresupuestoPage } from './pages/presupuestos/PresupuestoPage';
import { PresupuestosPage } from './pages/presupuestos/PresupuestosPage';
import { ProyectoDetallePage } from './pages/proyectos/ProyectoDetallePage';
import { ProyectosPage } from './pages/proyectos/ProyectosPage';
import { useEmpresa } from './lib/modulos';
import { ReciboDetallePage } from './pages/recibos/ReciboDetallePage';
import { RegistroPage } from './pages/RegistroPage';
import { VerificarReciboPage } from './pages/VerificarReciboPage';

function RedirigirImportacion() {
  const { id = '' } = useParams();
  return <Navigate to={rutaImportacion(id)} replace />;
}

/** Pantalla de entrada: Comprobantes si la empresa factura; si no, sus proyectos. */
function Inicio() {
  const { tiene } = useEmpresa();
  const destino = tiene('comprobantes') ? '/comprobantes' : tiene('proyectos') ? '/proyectos' : '/clientes';
  return <Navigate to={destino} replace />;
}

/** Al entrar (el login lleva a "/"): si la empresa no terminó de configurarse, lo primero es eso. */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/acceso" element={<AccesoPage />} />
      {/* Pública: a dónde lleva el QR de un recibo. */}
      <Route path="/verificar/recibo/:id" element={<VerificarReciboPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {/* Si falta configurar, AppLayout lo avisa con un modal al ingresar. */}
        <Route index element={<Inicio />} />
        <Route path="primeros-pasos" element={<PrimerosPasosPage />} />
        <Route path="comprobantes" element={<ComprobantesPage />} />
        <Route path="comprobantes/nuevo" element={<NuevoComprobantePage />} />
        <Route path="comprobantes/importaciones/:id" element={<ImportacionDetallePage />} />
        <Route path="comprobantes/recibos/:id" element={<ReciboDetallePage />} />
        <Route path="comprobantes/:id" element={<ComprobanteDetallePage />} />
        {/* Importaciones y Recibos pasaron a Nuevo comprobante (Factura masiva / Recibo): las URLs viejas redirigen. */}
        <Route path="importaciones" element={<Navigate to={RUTA_CREACION_MASIVA} replace />} />
        <Route path="importaciones/:id" element={<RedirigirImportacion />} />
        <Route path="recibos" element={<Navigate to={RUTA_RECIBO} replace />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="clientes/nuevo" element={<ClientePage />} />
        <Route path="clientes/:id" element={<ClienteDetallePage />} />
        <Route path="clientes/:id/editar" element={<ClientePage />} />
        <Route path="proyectos" element={<ProyectosPage />} />
        <Route path="proyectos/nuevo" element={<NuevoProyectoPage />} />
        <Route path="proyectos/:id" element={<ProyectoDetallePage />} />
        <Route path="presupuestos" element={<PresupuestosPage />} />
        <Route path="presupuestos/nuevo" element={<PresupuestoPage />} />
        <Route path="presupuestos/biblioteca" element={<BibliotecaPage />} />
        <Route path="presupuestos/:id" element={<PresupuestoPage />} />
        <Route path="cuenta-corriente" element={<CuentaCorrientePage />} />
        <Route path="cuenta-corriente/:clienteId" element={<CuentaClientePage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
        <Route path="perfil" element={<PerfilPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
