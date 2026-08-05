import { useMemo, useState, useEffect } from "react";
import DashboardCards from "../components/DashboardCards";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { APPOINTMENT_STATUS, getAppointmentStatus, isActiveAppointment } from "../utils/appointments";
import { getAppointmentWindowLabel } from "../utils/appointmentWindow";
import { getActivationState, getPublicBookingReadiness } from "../utils/onboarding";
import { getAccountAccess } from "../utils/trial";
import { formatLocalDate } from "../utils/date";
import { pluralize } from "../utils/format";
import { reportError, trackEvent } from "../utils/telemetry";


const activityLabels = {
  client_created: "Cliente criado",
  client_updated: "Cliente atualizado",
  client_archived: "Cliente arquivado",
  client_restored: "Cliente restaurado",
  service_created: "Servico criado",
  service_updated: "Servico atualizado",
  service_archived: "Servico arquivado",
  service_restored: "Servico restaurado",
  barber_created: "Barbeiro criado",
  barber_updated: "Barbeiro atualizado",
  barber_archived: "Barbeiro arquivado",
  barber_restored: "Barbeiro restaurado",
  appointment_created: "Agendamento criado",
  appointment_updated: "Agendamento atualizado",
  appointment_status_updated: "Status alterado",
};

const formatActivityTime = (value) => {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Agora";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const normalizeSlug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/(^-|-$)/g, "");

export default function Dashboard({
  totalRevenue,
  appointments,
  clients,
  services,
  barbers = [],
  profile,
  appointmentWindow,
  auditLogs = [],
  auditLogsLoading = false,
}) {
  const { updateProfile, isSlugAvailable, user } = useAuth();
  const [copyMessage, setCopyMessage] = useState("");
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState(profile?.slug || "");
  const [slugError, setSlugError] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const currentSlug = profile?.slug || "";
  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const publicPath = currentSlug ? `/${currentSlug}` : null;
  const publicUrl = publicPath ? `${publicOrigin}${publicPath}` : "";
  const accountAccess = getAccountAccess(profile);
  const appointmentWindowLabel = getAppointmentWindowLabel(appointmentWindow);
  const trialDaysRemaining = accountAccess.trialDaysRemaining;
  const accountTone =
    accountAccess.status === "active"
      ? "emerald"
      : accountAccess.status === "trialing"
      ? "indigo"
      : accountAccess.status === "legacy_active"
      ? "gray"
      : "yellow";

  useEffect(() => {
    setSlugInput(profile?.slug || "");
  }, [profile?.slug]);

  useEffect(() => {
    const normalized = normalizeSlug(slugInput || "");
    setPreviewUrl(normalized ? `${publicOrigin}/${normalized}` : "");
  }, [slugInput, publicOrigin]);

  useEffect(() => {
    if (!isEditingSlug) {
      setSlugError("");
      setSlugChecking(false);
      return;
    }

    const normalized = normalizeSlug(slugInput || "");
    if (!normalized) {
      setSlugError("O slug nao pode ficar vazio.");
      setSlugChecking(false);
      return;
    }

    setSlugChecking(true);
    const timeout = setTimeout(async () => {
      try {
        const available = await isSlugAvailable(normalized, user?.uid);
        setSlugError(available ? "" : "Este endereco ja esta em uso.");
      } catch (err) {
        reportError(err, { source: "dashboard", action: "check-slug" });
        setSlugError("Erro ao verificar disponibilidade.");
      } finally {
        setSlugChecking(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [slugInput, isEditingSlug, isSlugAvailable, user]);

  const copyPublicLink = async () => {
    if (!publicUrl || !publicReadiness.isReady) {
      setCopyMessage(publicReadiness.nextStep?.label || "Complete o link publico antes de copiar");
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyMessage("Link copiado!");
      trackEvent("public_link_copied", { source: "dashboard", action: "copy-public-link" });
      window.setTimeout(() => setCopyMessage(""), 2000);
    } catch (err) {
      reportError(err, { source: "dashboard", action: "copy-public-link" });
      setCopyMessage("Erro ao copiar");
    }
  };

  const handleSaveSlug = async () => {
    const normalized = normalizeSlug(slugInput || "");
    if (!normalized) {
      setSlugError("O slug nao pode ficar vazio.");
      return;
    }
    if (slugError) {
      setSaveError("Corrija o slug antes de salvar.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const available = await isSlugAvailable(normalized, user?.uid);
      if (!available) {
        setSlugError("Este endereco ja esta em uso.");
        setSaveError("Escolha outro slug publico.");
        return;
      }

      await updateProfile({ slug: normalized });
      setSaveSuccess("Link salvo com sucesso!");
      setIsEditingSlug(false);
      trackEvent("public_slug_updated", { source: "dashboard", action: "save-slug" });
    } catch (err) {
      reportError(err, { source: "dashboard", action: "save-slug" });
      if (err.message === "slug-unavailable") {
        setSlugError("Este endereco acabou de ser reservado por outra conta.");
        setSaveError("Escolha outro slug publico.");
      } else {
        setSaveError("Erro ao salvar. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  const activeAppointments = useMemo(
    () => appointments.filter(isActiveAppointment),
    [appointments]
  );
  const today = formatLocalDate();
  const todayAppointments = useMemo(
    () => activeAppointments.filter((appointment) => appointment.date === today),
    [activeAppointments, today]
  );
  const pendingAppointments = useMemo(
    () => appointments.filter((appointment) => getAppointmentStatus(appointment) === APPOINTMENT_STATUS.pending),
    [appointments]
  );
  const nextAppointment = useMemo(
    () =>
      [...activeAppointments].sort((first, second) => {
        const firstValue = `${first.date || ""} ${first.time || ""}`;
        const secondValue = `${second.date || ""} ${second.time || ""}`;
        return firstValue.localeCompare(secondValue);
      })[0],
    [activeAppointments]
  );
  const hasData = appointments.length > 0 || clients.length > 0 || services.length > 0;
  const activation = getActivationState({
    profile,
    servicesCount: services.length,
    barbersCount: barbers.length,
    clientsCount: clients.length,
    appointmentsCount: appointments.length,
  });
  const publicReadiness = getPublicBookingReadiness({
    profile,
    servicesCount: services.length,
    barbersCount: barbers.length,
  });

  const publicLinkStatusCopy =
    publicPath && publicReadiness.isReady
      ? "Seu link publico ja pode ser compartilhado com clientes."
      : publicReadiness.nextStep?.label || "Complete seu perfil para ativar sua pagina publica.";

  return (
    <main className="flex-1 overflow-y-auto p-4 text-white sm:p-6 lg:p-8">
      <div className="mb-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Painel operacional</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Dashboard</h2>
            <p className="text-gray-400 mt-2 max-w-2xl">
              Acompanhe agenda, clientes, equipe e receita realizada sem perder o proximo passo.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-500">{appointmentWindowLabel}</p>
          </div>

          <Link
            to="/agenda"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-black font-semibold shadow-sm transition hover:bg-gray-200"
          >
            Novo agendamento
          </Link>
        </div>

        <div
          className={`rounded-3xl border p-5 shadow-sm ${
            accountTone === "emerald"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : accountTone === "yellow"
              ? "border-yellow-500/30 bg-yellow-500/10"
              : accountTone === "gray"
              ? "border-gray-700 bg-gray-900"
              : "border-indigo-500/30 bg-indigo-500/10"
          }`}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p
                  className={`text-sm uppercase tracking-[0.3em] ${
                    accountTone === "emerald"
                      ? "text-emerald-300"
                      : accountTone === "yellow"
                      ? "text-yellow-300"
                      : accountTone === "gray"
                      ? "text-gray-400"
                      : "text-indigo-300"
                  }`}
                >
                  Assinatura
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {accountAccess.label}
                  {accountAccess.status === "trialing" && trialDaysRemaining !== null
                    ? `, ${trialDaysRemaining} ${trialDaysRemaining === 1 ? "dia restante" : "dias restantes"}`
                    : ""}
                </p>
              </div>
              <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-sm text-indigo-100">
                Plano {accountAccess.plan === "trial" ? "trial" : accountAccess.plan}
              </span>
            </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Bem-vindo de volta</p>
            <h3 className="mt-3 text-2xl font-bold">{profile?.barbershopName || profile?.displayName || "Sua barbearia"}</h3>
            <p className="mt-3 text-gray-400 max-w-2xl">
              Hoje voce tem {pluralize(todayAppointments.length, "agendamento")}{" "}
              {todayAppointments.length === 1 ? "ativo" : "ativos"} e{" "}
              {pluralize(pendingAppointments.length, "solicitacao", "solicitacoes")}{" "}
              {pendingAppointments.length === 1 ? "pendente" : "pendentes"}.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Hoje</p>
                <p className="mt-2 text-2xl font-black">{todayAppointments.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Pendentes</p>
                <p className="mt-2 text-2xl font-black">{pendingAppointments.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Equipe</p>
                <p className="mt-2 text-2xl font-black">{barbers.length}</p>
              </div>
            </div>
            <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-gray-400">Sua pagina publica</p>
                  <p className="mt-1 text-sm text-indigo-300 break-all">
                    {isEditingSlug ? previewUrl || `/${slugInput || "..."}` : publicPath || "/seu-slug-aqui"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {publicPath && !isEditingSlug && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSlug(true)}
                      className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Editar link
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={copyPublicLink}
                    disabled={!publicReadiness.isReady}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copiar link
                  </button>
                  {publicPath && publicReadiness.isReady && (
                    <a
                      href={publicPath}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Abrir pagina
                    </a>
                  )}
                  {publicPath && !publicReadiness.isReady && publicReadiness.nextStep && (
                    <Link
                      to={publicReadiness.nextStep.to}
                      className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Ajustar link
                    </Link>
                  )}
                </div>
              </div>

              {isEditingSlug ? (
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="text-sm text-gray-300">Editar URL</span>
                    <div className="mt-2 flex rounded-2xl border border-gray-800 bg-gray-900 p-3">
                      <span className="min-w-0 break-all text-gray-500">{publicOrigin}/</span>
                      <input
                        value={slugInput}
                        onChange={(e) => setSlugInput(e.target.value)}
                        className="ml-2 w-full bg-transparent text-white outline-none placeholder:text-gray-500"
                        placeholder="nome-da-barbearia"
                      />
                    </div>
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 text-sm">
                      {slugChecking && <p className="text-indigo-300">Verificando disponibilidade...</p>}
                      {slugError && <p className="text-red-400">{slugError}</p>}
                      {!slugError && !slugChecking && slugInput && (
                        <p className="text-green-300">Slug disponivel</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveSlug}
                        disabled={saving || !!slugError || !slugInput}
                        className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? "Salvando..." : "Salvar alteracao"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingSlug(false);
                          setSlugInput(currentSlug);
                          setSlugError("");
                          setSaveError("");
                          setSaveSuccess("");
                        }}
                        className="rounded-2xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:border-gray-500"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                  {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                  {saveSuccess && <p className="text-sm text-green-400">{saveSuccess}</p>}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
                  {publicLinkStatusCopy}
                </div>
              )}
              {copyMessage && <p className="mt-3 text-sm text-green-300">{copyMessage}</p>}
            </div>
          </div>

          <DashboardCards
            totalRevenue={totalRevenue}
            appointmentsCount={activeAppointments.length}
            clientsCount={clients.length}
            servicesCount={services.length}
            metricScopeLabel="na janela operacional"
          />
        </div>
      </div>

      {!activation.isActivated && (
        <section className="mb-8 overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 shadow-sm">
          <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="border-b border-gray-800 bg-gray-950 p-5 sm:p-6 xl:border-b-0 xl:border-r">
              <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Ativacao guiada</p>
              <h3 className="mt-3 text-2xl font-bold">Deixe o BarberOS pronto para vender</h3>
              <p className="mt-3 text-sm leading-6 text-gray-400">
                Complete o minimo operacional antes de compartilhar o link com clientes. Isso reduz agendamento
                errado, link incompleto e retrabalho no WhatsApp.
              </p>
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{activation.completedCount}/{activation.totalCount} etapas</span>
                  <span>{activation.progress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full bg-indigo-400 transition-all"
                    style={{ width: `${activation.progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {activation.nextItem && (
                <div className="mb-5 rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Proxima melhor acao</p>
                      <h4 className="mt-2 text-xl font-bold text-white">{activation.nextItem.label}</h4>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
                        {activation.nextItem.description}
                      </p>
                      <p className="mt-2 text-sm text-indigo-200">{activation.nextItem.impact}</p>
                    </div>
                    <Link
                      to={activation.nextItem.to}
                      className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
                    >
                      {activation.nextItem.actionLabel}
                    </Link>
                  </div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {activation.items.map((item, index) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={`rounded-2xl border p-4 text-sm transition ${
                      item.done
                        ? "border-emerald-700 bg-emerald-950/40 text-emerald-100"
                        : item.id === activation.nextItem?.id
                        ? "border-indigo-500 bg-indigo-500/10 text-white"
                        : "border-gray-800 bg-gray-950 text-gray-300 hover:border-indigo-500"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.2em] text-gray-500">
                        Etapa {index + 1}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          item.done ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-gray-300"
                        }`}
                      >
                        {item.done ? "Pronto" : "Pendente"}
                      </span>
                    </span>
                    <span className="mt-3 block font-semibold">{item.label}</span>
                    <span className="mt-2 block text-xs leading-5 text-gray-400">{item.impact}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}


      <section className="mb-8 rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Auditoria</p>
            <h3 className="mt-2 text-2xl font-bold">Atividade recente</h3>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Ultimas alteracoes operacionais registradas para ajudar em suporte, conferencia e investigacao.
            </p>
          </div>
          <span className="w-fit rounded-full bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-gray-400">
            {auditLogsLoading ? "Sincronizando" : auditLogs.length + " eventos"}
          </span>
        </div>

        {auditLogsLoading ? (
          <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-950 p-5 text-sm text-gray-400">
            Carregando atividades...
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-950 p-5 text-sm text-gray-400">
            Nenhuma atividade registrada ainda. Novos cadastros, arquivamentos, restauracoes e mudancas de agenda aparecerao aqui.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {auditLogs.slice(0, 8).map((activity) => (
              <article key={activity.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {activityLabels[activity.action] || activity.action || "Atividade"}
                    </p>
                    <p className="mt-1 truncate text-sm text-indigo-200">{activity.entityLabel || activity.entityType || "Registro"}</p>
                    {activity.summary && <p className="mt-2 text-sm leading-5 text-gray-400">{activity.summary}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400">
                    {formatActivityTime(activity.createdAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold">Proxima acao recomendada</h3>
            <p className="text-gray-400 mt-2 max-w-2xl">
              {nextAppointment
                ? `Proximo horario: ${nextAppointment.client?.name || nextAppointment.clientName || "Cliente"} em ${nextAppointment.date} as ${nextAppointment.time}.`
                : hasData
                ? "Nao ha agendamentos ativos. Compartilhe o link publico ou crie um encaixe manual."
                : "Ainda falta a base operacional. Cadastre servicos, equipe e primeiro agendamento para validar o fluxo."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/agenda"
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              Ver agenda
            </Link>
            <Link
              to="/perfil"
              className="rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-gray-500"
            >
              Revisar link publico
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
