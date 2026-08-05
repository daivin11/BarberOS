import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getActivationState, getPublicBookingReadiness } from "../utils/onboarding";
import { reportError, trackEvent } from "../utils/telemetry";

const navItems = [
  { to: "/dashboard", label: "Dashboard", initials: "DB" },
  { to: "/agenda", label: "Agenda", initials: "AG" },
  { to: "/clientes", label: "Clientes", initials: "CL" },
  { to: "/servicos", label: "Servicos", initials: "SV" },
  { to: "/barbeiros", label: "Equipe", initials: "EQ" },
  { to: "/financeiro", label: "Financeiro", initials: "FN" },
  { to: "/whatsapp", label: "WhatsApp", initials: "WA" },
  { to: "/perfil", label: "Perfil", initials: "PF" },
];

export default function Sidebar({
  clientsCount = 0,
  servicesCount = 0,
  barbersCount = 0,
  appointmentsCount = 0,
}) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [copyMessage, setCopyMessage] = useState("");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const publicPath = profile?.slug ? `/${profile.slug}` : "";
  const publicUrl = publicPath ? `${window.location.origin}${publicPath}` : "";
  const businessName = profile?.barbershopName || profile?.displayName || "Sua barbearia";
  const activation = getActivationState({
    profile,
    servicesCount,
    barbersCount,
    clientsCount,
    appointmentsCount,
  });
  const publicReadiness = getPublicBookingReadiness({
    profile,
    servicesCount,
    barbersCount,
  });

  const copyPublicLink = async () => {
    if (!publicUrl || !publicReadiness.isReady) {
      setCopyMessage(publicReadiness.nextStep?.label || "Complete o link publico antes de copiar");
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyMessage("Link copiado");
      trackEvent("public_link_copied", { source: "sidebar", action: "copy-public-link" });
      window.setTimeout(() => setCopyMessage(""), 2000);
    } catch (error) {
      reportError(error, { source: "sidebar", action: "copy-public-link" });
      setCopyMessage("Erro ao copiar");
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      reportError(error, { source: "sidebar", action: "logout" });
      setCopyMessage("Erro ao sair");
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <>
    <aside className="sticky top-0 z-40 w-full border-b border-gray-800 bg-gray-950/95 p-4 text-white backdrop-blur-xl lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:p-6">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-lg font-black shadow-lg shadow-indigo-950/40">
              B
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black tracking-tight">BarberOS</h1>
              <p className="truncate text-xs uppercase tracking-[0.25em] text-gray-500">Studio suite</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            className="shrink-0 rounded-2xl border border-gray-800 bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60 lg:hidden"
          >
            {logoutLoading ? "..." : "Sair"}
          </button>
        </div>

        <div className="mt-4 hidden rounded-2xl border border-gray-800 bg-gray-900 p-4 lg:mt-6 lg:block">
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Barbearia</p>
          <p className="mt-2 truncate text-base font-semibold">{businessName}</p>

          {!activation.isActivated && (
            <div className="mt-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold uppercase tracking-[0.2em] text-indigo-200">
                  Ativacao
                </span>
                <span className="text-gray-300">{activation.completedCount}/{activation.totalCount}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-950">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all"
                  style={{ width: `${activation.progress}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-gray-300">
                Proximo: <span className="font-semibold text-white">{activation.nextItem?.label}</span>
              </p>
              {activation.nextItem && (
                <Link
                  to={activation.nextItem.to}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-gray-200"
                >
                  {activation.nextItem.actionLabel}
                </Link>
              )}
            </div>
          )}

          {profile?.slug ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-indigo-300">
                <p className="truncate">{publicPath}</p>
              </div>
              {!publicReadiness.isReady && (
                <div className="rounded-2xl border border-yellow-700 bg-yellow-950/40 p-3 text-sm text-yellow-100">
                  <p className="font-semibold">Link em preparacao</p>
                  <p className="mt-1 text-yellow-200">{publicReadiness.nextStep?.label}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyPublicLink}
                  disabled={!publicReadiness.isReady}
                  className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copiar
                </button>
                {publicReadiness.isReady ? (
                  <a
                    href={publicPath}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-gray-200"
                  >
                    Abrir
                  </a>
                ) : (
                  <Link
                    to={publicReadiness.nextStep?.to || "/perfil"}
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-gray-200"
                  >
                    Ajustar
                  </Link>
                )}
              </div>
              {copyMessage && <p className="text-xs text-green-300">{copyMessage}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-400">
              Complete o perfil para ativar seu link publico.
            </p>
          )}
        </div>

        <div className="mt-3 grid gap-2 lg:hidden">
          {!activation.isActivated && (
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold uppercase tracking-[0.2em] text-indigo-200">
                  Ativacao
                </span>
                <span className="text-gray-300">{activation.completedCount}/{activation.totalCount}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-950">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all"
                  style={{ width: `${activation.progress}%` }}
                />
              </div>
            </div>
          )}

          {profile?.slug && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-2xl border border-gray-800 bg-gray-900 p-2">
              <span className="truncate px-2 text-sm text-indigo-300">{publicPath}</span>
              <button
                type="button"
                onClick={copyPublicLink}
                disabled={!publicReadiness.isReady}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copiar
              </button>
              {publicReadiness.isReady ? (
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-gray-200"
                >
                  Abrir
                </a>
              ) : (
                <Link
                  to={publicReadiness.nextStep?.to || "/perfil"}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-gray-200"
                >
                  Ajustar
                </Link>
              )}
            </div>
          )}

          {copyMessage && <p className="text-xs text-green-300">{copyMessage}</p>}
        </div>

        <nav className="scrollbar-hidden mt-6 hidden min-h-0 flex-1 flex-col gap-2 overflow-y-auto lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition lg:shrink ${
                  isActive
                    ? "bg-white text-black shadow-sm"
                    : "text-gray-300 hover:bg-gray-900 hover:text-white"
                }`
              }
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-current/10 bg-current/5 text-[11px] font-black">
                {item.initials}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutLoading}
          className="mt-4 hidden w-full rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-left text-sm font-semibold text-gray-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60 lg:mt-6 lg:block"
        >
          {logoutLoading ? "Saindo..." : "Sair"}
        </button>
      </div>
    </aside>
    <nav
      className="scrollbar-hidden fixed inset-x-0 bottom-0 z-40 flex gap-2 overflow-x-auto border-t border-gray-800 bg-gray-950/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 text-white shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden"
      aria-label="Navegacao principal"
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex min-w-[76px] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold transition ${
              isActive
                ? "bg-white text-black shadow-sm"
                : "text-gray-300 hover:bg-gray-900 hover:text-white"
            }`
          }
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-current/10 bg-current/5 text-[10px] font-black">
            {item.initials}
          </span>
          <span className="whitespace-nowrap">{item.label}</span>
        </NavLink>
      ))}
    </nav>
    </>
  );
}
