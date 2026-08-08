import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "../hooks/useAuth";
import { db } from "../services/firebase";
import {
  BILLING_PLANS,
  createRenewalRequestId,
  createRenewalRequestPayload,
  getBillingStatusLabel,
  getBlockedAccountContent,
  getPlanLabel,
} from "../utils/billing";
import { createWhatsAppUrl, normalizePhone } from "../utils/phone";
import { getAccountAccess, toDate } from "../utils/trial";
import { reportError, trackEvent } from "../utils/telemetry";

const supportWhatsapp = normalizePhone(import.meta.env.VITE_SUPPORT_WHATSAPP || "");
const renewalMessage = "Ola, quero falar sobre a assinatura do BarberOS.";
const renewalWhatsappLink = supportWhatsapp
  ? createWhatsAppUrl({ phone: supportWhatsapp, message: renewalMessage })
  : "";

export default function TrialExpired() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestMessageType, setRequestMessageType] = useState("status");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("studio");
  const trialEndsAt = toDate(profile?.trialEndsAt);
  const accountAccess = getAccountAccess(profile);
  const blockedContent = getBlockedAccountContent(accountAccess);
  const formattedDate = trialEndsAt
    ? trialEndsAt.toLocaleDateString("pt-BR")
    : "data nao disponivel";

  const handleLogout = async () => {
    if (logoutLoading) return;

    setLogoutLoading(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      reportError(error, { source: "trial-expired", action: "logout" });
      setRequestMessage("Nao foi possivel sair agora. Tente novamente.");
      setRequestMessageType("alert");
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleRenewalRequest = async () => {
    if (requestLoading) return;
    if (!user) return;

    setRequestLoading(true);
    setRequestMessage("");
    setRequestMessageType("status");

    try {
      const timestamp = new Date();
      await setDoc(
        doc(db, "renewalRequests", createRenewalRequestId(user.uid)),
        createRenewalRequestPayload({
          userId: user.uid,
          profile,
          accountAccess,
          requestedPlan: selectedPlan,
          now: timestamp,
        })
      );
      setRequestMessage("Solicitacao enviada. Entraremos em contato em breve.");
      setRequestMessageType("status");
      trackEvent("renewal_requested", { source: "trial-expired", action: "request-renewal" });
    } catch (error) {
      reportError(error, { source: "trial-expired", action: "request-renewal" });
      setRequestMessage(
        error.code === "permission-denied"
          ? "Ja existe uma solicitacao pendente para esta conta."
          : "Nao foi possivel enviar a solicitacao. Tente novamente."
      );
      setRequestMessageType("alert");
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gray-950 p-4 text-white sm:p-6 md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <section className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-red-900/60 bg-gray-900 p-6 shadow-sm sm:p-8 md:p-10">
            <p className="text-sm uppercase tracking-[0.3em] text-red-300">
              {getBillingStatusLabel(accountAccess.status)}
            </p>
            <h1 className="mt-4 text-3xl font-bold md:text-4xl">{blockedContent.title}</h1>
            <p className="mt-4 max-w-2xl text-gray-400">
              {blockedContent.description} Seus dados continuam preservados na sua conta: agendamentos,
              clientes, servicos e equipe nao foram apagados.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
                  {blockedContent.referenceLabel}
                </p>
                <p className="mt-3 text-2xl font-semibold">{formattedDate}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Plano</p>
                <p className="mt-3 text-2xl font-semibold text-red-300">
                  {getPlanLabel(accountAccess.plan)}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Escolha um plano</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {BILLING_PLANS.map((plan) => {
                  const selected = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-indigo-400 bg-indigo-500/15 text-white"
                          : "border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-600"
                      }`}
                      aria-pressed={selected}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span>
                          <span className="block font-semibold">{plan.label}</span>
                          <span className="mt-1 block text-sm text-gray-400">{plan.price}</span>
                        </span>
                        {plan.recommended && (
                          <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-indigo-100">
                            Popular
                          </span>
                        )}
                      </span>
                      <span className="mt-3 block text-sm leading-5 text-gray-400">{plan.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {renewalWhatsappLink && (
                <a
                  href={renewalWhatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                >
                  Falar no WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={handleRenewalRequest}
                disabled={requestLoading}
                aria-busy={requestLoading ? "true" : "false"}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestLoading ? "Enviando..." : blockedContent.actionLabel}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutLoading}
                aria-busy={logoutLoading ? "true" : "false"}
                className="rounded-2xl border border-gray-700 bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40"
              >
                {logoutLoading ? "Saindo..." : "Sair"}
              </button>
            </div>
            {requestMessage && (
              <p
                className={`mt-4 text-sm ${requestMessageType === "alert" ? "text-red-300" : "text-gray-300"}`}
                role={requestMessageType === "alert" ? "alert" : "status"}
                aria-live={requestMessageType === "alert" ? "assertive" : "polite"}
              >
                {requestMessage}
              </p>
            )}
          </div>

          <aside className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-sm sm:p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Proximo passo</p>
            <h2 className="mt-4 text-2xl font-bold">{blockedContent.nextStepTitle}</h2>
            <p className="mt-4 text-gray-400">{blockedContent.nextStepDescription}</p>
            <div className="mt-6 space-y-3">
              {BILLING_PLANS.find((plan) => plan.id === selectedPlan)?.features.map((feature) => (
                <div key={feature} className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-300">
                  {feature}
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
