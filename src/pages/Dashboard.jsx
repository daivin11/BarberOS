import { useState, useEffect } from "react";
import DashboardCards from "../components/DashboardCards";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getTrialDaysRemaining } from "../utils/trial";

export default function Dashboard({
  totalRevenue,
  appointments,
  clients,
  services,
  profile,
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
  const publicPath = currentSlug ? `/${currentSlug}` : null;
  const publicUrl = publicPath ? `${window.location.origin}${publicPath}` : "";
  const trialDaysRemaining = getTrialDaysRemaining(profile);

  useEffect(() => {
    setSlugInput(profile?.slug || "");
  }, [profile?.slug]);

  useEffect(() => {
    const normalized = normalizeSlug(slugInput || "");
    setPreviewUrl(normalized ? `${window.location.origin}/${normalized}` : "");
  }, [slugInput]);

  useEffect(() => {
    if (!isEditingSlug) {
      setSlugError("");
      setSlugChecking(false);
      return;
    }

    const normalized = normalizeSlug(slugInput || "");
    if (!normalized) {
      setSlugError("O slug não pode ficar vazio.");
      setSlugChecking(false);
      return;
    }

    setSlugChecking(true);
    const timeout = setTimeout(async () => {
      try {
        const available = await isSlugAvailable(normalized, user?.uid);
        setSlugError(available ? "" : "Este endereço já está em uso.");
      } catch (err) {
        console.error(err);
        setSlugError("Erro ao verificar disponibilidade.");
      } finally {
        setSlugChecking(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [slugInput, isEditingSlug, isSlugAvailable, user]);

  const normalizeSlug = (value) =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]+/g, "")
      .replace(/(^-|-$)/g, "");

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyMessage("Link copiado!");
      window.setTimeout(() => setCopyMessage(""), 2000);
    } catch (err) {
      console.error(err);
      setCopyMessage("Erro ao copiar");
    }
  };

  const handleSaveSlug = async () => {
    const normalized = normalizeSlug(slugInput || "");
    if (!normalized) {
      setSlugError("O slug não pode ficar vazio.");
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
        setSlugError("Este endereço já está em uso.");
        setSaveError("Escolha outro slug público.");
        return;
      }

      await updateProfile({ slug: normalized });
      setSaveSuccess("Link salvo com sucesso!");
      setIsEditingSlug(false);
    } catch (err) {
      console.error(err);
      setSaveError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const activeAppointments = appointments.filter((appointment) => appointment.status !== "cancelled");
  const hasData = appointments.length > 0 || clients.length > 0 || services.length > 0;

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto text-white">
      <div className="mb-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-gray-400 mt-2 max-w-2xl">
              Visão geral dos seus clientes, serviços, agendamentos e faturamento.
            </p>
          </div>

          <Link
            to="/agenda"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-black font-semibold shadow-sm transition hover:bg-gray-200"
          >
            Novo agendamento
          </Link>
        </div>

        {trialDaysRemaining !== null && (
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Teste gratuito</p>
                <p className="mt-2 text-lg font-semibold">
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? "dia restante" : "dias restantes"}
                </p>
              </div>
              <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-sm text-indigo-100">
                Plano trial de 30 dias
              </span>
            </div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Bem-vindo de volta</p>
            <h3 className="mt-3 text-2xl font-bold">{profile?.barbershopName || profile?.displayName || "Sua barbearia"}</h3>
            <p className="mt-3 text-gray-400 max-w-2xl">
              Aqui está a visão geral da sua barbearia. Use o painel para acompanhar a agenda, clientes e faturamento.
            </p>
            <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-gray-400">Sua página pública</p>
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
                    className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Copiar link
                  </button>
                  {publicPath && (
                    <a
                      href={publicPath}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Abrir página
                    </a>
                  )}
                </div>
              </div>

              {isEditingSlug ? (
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="text-sm text-gray-300">Editar URL</span>
                    <div className="mt-2 flex rounded-2xl border border-gray-800 bg-gray-900 p-3">
                      <span className="text-gray-500">barberos.app/</span>
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
                        <p className="text-green-300">Slug disponível</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveSlug}
                        disabled={saving || !!slugError || !slugInput}
                        className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? "Salvando..." : "Salvar alteração"}
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
                  {publicPath
                    ? "Você pode editar o link público para manter sua URL simples e memorável."
                    : "Complete seu perfil para ativar sua página pública."}
                </div>
              )}
            </div>
          </div>

          <DashboardCards
            totalRevenue={totalRevenue}
            appointmentsCount={activeAppointments.length}
            clientsCount={clients.length}
            servicesCount={services.length}
          />
        </div>
      </div>

      <section className="bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold">Resumo rápido</h3>
            <p className="text-gray-400 mt-2 max-w-2xl">
              {hasData
                ? "Seu sistema está ativo. Use a agenda e os cadastros para continuar crescendo."
                : "Nenhum dado cadastrado ainda. Comece adicionando clientes e serviços para criar agendamentos."}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
            {activeAppointments.length === 0 && <p>Agenda ativa vazia</p>}
            {clients.length === 0 && <p>Clientes não cadastrados</p>}
            {services.length === 0 && <p>Serviços não cadastrado</p>}
            {hasData && <p>Tudo funcionando normalmente.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
