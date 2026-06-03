import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Sidebar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [copyMessage, setCopyMessage] = useState("");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const publicPath = profile?.slug ? `/${profile.slug}` : "";
  const publicUrl = publicPath ? `${window.location.origin}${publicPath}` : "";

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyMessage("Link copiado!");
      window.setTimeout(() => setCopyMessage(""), 2000);
    } catch (error) {
      console.error(error);
      setCopyMessage("Erro ao copiar");
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error(error);
      setCopyMessage("Erro ao sair");
    } finally {
      setLogoutLoading(false);
    }
  };

  const navItem = (to, label) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-2xl px-4 py-3 transition-all duration-200 ${
          isActive
            ? "bg-gray-800 text-white shadow-sm"
            : "text-gray-300 hover:text-white hover:bg-gray-800"
        }`
      }
    >
      {label}
    </NavLink>
  );

  return (
    <aside className="w-full md:w-72 bg-gray-900 p-6 border-b border-gray-800 md:border-b-0 md:border-r">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 rounded-full p-3 shadow-sm">
            <span className="text-2xl">💈</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">BarberOS</h1>
            <p className="text-gray-400">Gestão premium</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-4">
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Barbearia</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {profile?.barbershopName || profile?.displayName || "Seu espaço"}
          </p>
          {profile?.slug ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-400">Link público</p>
              <div className="rounded-2xl border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-indigo-300 break-words">
                {publicPath}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={copyPublicLink}
                  className="w-full rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Copiar link público
                </button>
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  Abrir página
                </a>
              </div>
              {copyMessage && <p className="text-xs text-green-300">{copyMessage}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-400">Complete seu perfil para ativar o link público.</p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-6">
        <nav className="flex flex-col gap-3 text-gray-300">
          {navItem("/", "📊 Dashboard")}
          {navItem("/agenda", "📅 Agenda")}
          {navItem("/clientes", "👤 Clientes")}
          {navItem("/servicos", "✂️ Serviços")}
          {navItem("/barbeiros", "💈 Equipe")}
          {navItem("/financeiro", "💰 Financeiro")}
          {navItem("/whatsapp", "💬 WhatsApp")}
          {navItem("/perfil", "⚙️ Perfil")}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutLoading}
          className="w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-left text-sm font-semibold text-gray-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {logoutLoading ? "Saindo..." : "Sair"}
        </button>
      </div>
    </aside>
  );
}
