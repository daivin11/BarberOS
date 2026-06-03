import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toDate } from "../utils/trial";

export default function TrialExpired() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const trialEndsAt = toDate(profile?.trialEndsAt);
  const formattedDate = trialEndsAt
    ? trialEndsAt.toLocaleDateString("pt-BR")
    : "data nao disponivel";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gray-950 p-6 text-white md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <section className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-red-900/60 bg-gray-900 p-8 shadow-sm md:p-10">
            <p className="text-sm uppercase tracking-[0.3em] text-red-300">Trial expirado</p>
            <h1 className="mt-4 text-3xl font-bold md:text-4xl">Seu teste gratuito terminou</h1>
            <p className="mt-4 max-w-2xl text-gray-400">
              O acesso ao painel BarberOS foi pausado porque o periodo gratuito de 30 dias chegou ao fim.
              Seus dados continuam separados por conta e prontos para uma futura assinatura.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Fim do trial</p>
                <p className="mt-3 text-2xl font-semibold">{formattedDate}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Status</p>
                <p className="mt-3 text-2xl font-semibold text-red-300">Bloqueado</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled
                className="rounded-2xl bg-gray-700 px-5 py-3 text-sm font-semibold text-gray-300 opacity-70"
              >
                Assinatura em breve
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl border border-gray-700 bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40"
              >
                Sair
              </button>
            </div>
          </div>

          <aside className="rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Proximo passo</p>
            <h2 className="mt-4 text-2xl font-bold">Pagamento ainda nao foi implementado</h2>
            <p className="mt-4 text-gray-400">
              Esta tela apenas bloqueia o acesso quando o trial expira. O gateway de pagamento pode ser
              conectado depois sem alterar a estrutura multi-tenant atual.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
