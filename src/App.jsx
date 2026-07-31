import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppErrorBoundary from "./components/AppErrorBoundary";
import NetworkStatusBanner from "./components/NetworkStatusBanner";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const AuthShell = lazy(() => import("./AuthShell"));

const adminPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/dashboard",
  "/clientes",
  "/servicos",
  "/barbeiros",
  "/financeiro",
  "/agenda",
  "/whatsapp",
  "/perfil",
  "/setup-profile",
];

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
      <div className="rounded-2xl border border-gray-800 bg-gray-900 px-5 py-4 text-sm text-gray-300">
        Carregando...
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <NetworkStatusBanner />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {adminPaths.map((path) => (
            <Route key={path} path={path} element={<AuthShell />} />
          ))}
          <Route path="/:slug" element={<PublicBooking />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}
