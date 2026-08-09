import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { createWorkspaceExportFilename, createWorkspaceExportPayload } from "../utils/dataExport";
import { formatLocalDate } from "../utils/date";
import { formatDuration } from "../utils/format";
import { PROFILE_LIMITS, normalizeSlug, validatePublicProfileInput } from "../utils/profileValidation";
import {
  BUSINESS_HOURS_LIMITS,
  defaultBusinessHours,
  isValidDateString,
  normalizeBlockedDates,
  normalizeBusinessHours,
  validateBlockedDatesInput,
  validateBusinessHoursInput,
} from "../utils/schedule";
import { reportError, trackEvent } from "../utils/telemetry";

export default function ProfileSettings({ workspaceData = {} }) {
  const { user, profile, updateProfile, isSlugAvailable } = useAuth();
  const [searchParams] = useSearchParams();
  const [barbershopName, setBarbershopName] = useState(profile?.barbershopName || "");
  const [slug, setSlug] = useState(profile?.slug || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [logoUrl, setLogoUrl] = useState(profile?.logoUrl || "");
  const [businessHours, setBusinessHours] = useState(profile?.businessHours || defaultBusinessHours);
  const [blockedDateInput, setBlockedDateInput] = useState("");
  const [blockedDates, setBlockedDates] = useState(profile?.blockedDates || []);
  const [slugError, setSlugError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const slugCheckRequestRef = useRef(0);

  const normalizedSlug = useMemo(() => normalizeSlug(slug || ""), [slug]);
  const previewUrl = normalizedSlug ? `${window.location.origin}/${normalizedSlug}` : "";
  const setupStep = searchParams.get("setup");
  const isSetupMode = setupStep === "profile" || setupStep === "hours";
  const setupCopy =
    setupStep === "hours"
      ? {
          title: "Defina os horarios que geram sua agenda publica",
          description: "A grade de horarios usa abertura, fechamento, intervalo e datas bloqueadas para evitar reservas impossiveis.",
        }
      : {
          title: "Complete o perfil publico antes de divulgar o link",
          description: "Nome, telefone, URL e bio deixam o cliente seguro de que esta agendando na barbearia certa.",
        };

  useEffect(() => {
    setBarbershopName(profile?.barbershopName || "");
    setSlug(profile?.slug || "");
    setPhone(profile?.phone || "");
    setBio(profile?.bio || "");
    setLogoUrl(profile?.logoUrl || "");
    setBusinessHours(profile?.businessHours || defaultBusinessHours);
    setBlockedDates(profile?.blockedDates || []);
  }, [profile]);

  const handleSlugBlur = async () => {
    if (!normalizedSlug) {
      setSlug("");
      setSlugError("O slug nao pode ficar vazio.");
      return;
    }

    const requestId = slugCheckRequestRef.current + 1;
    slugCheckRequestRef.current = requestId;
    setSlug(normalizedSlug);
    setSlugChecking(true);
    setSaveError("");

    try {
      const available = await isSlugAvailable(normalizedSlug, user?.uid);
      if (requestId !== slugCheckRequestRef.current) return;
      setSlugError(available ? "" : "Este slug ja esta em uso.");
    } catch (error) {
      if (requestId !== slugCheckRequestRef.current) return;
      reportError(error, { source: "profile-settings", action: "check-slug" });
      setSlugError("Nao foi possivel verificar o slug.");
    } finally {
      if (requestId === slugCheckRequestRef.current) setSlugChecking(false);
    }
  };

  const handleSlugChange = (event) => {
    slugCheckRequestRef.current += 1;
    setSlug(event.target.value);
    setSlugError("");
    setSaveError("");
    setSaveSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = barbershopName.trim();
    const trimmedPhone = phone.trim();
    const trimmedBio = bio.trim();
    const trimmedLogoUrl = logoUrl.trim();
    const normalizedBusinessHours = normalizeBusinessHours(businessHours);
    const normalizedBlockedDates = normalizeBlockedDates(blockedDates);
    const validationError = validatePublicProfileInput({
      barbershopName: trimmedName,
      slug: normalizedSlug,
      phone: trimmedPhone,
      bio: trimmedBio,
      logoUrl: trimmedLogoUrl,
    });

    if (validationError) {
      setSaveError(validationError);
      setSaveSuccess("");
      return;
    }

    if (slugError) {
      setSaveError("Corrija o slug antes de salvar.");
      setSaveSuccess("");
      return;
    }

    const businessHoursError = validateBusinessHoursInput(businessHours);
    if (businessHoursError) {
      setSaveError(businessHoursError);
      setSaveSuccess("");
      return;
    }

    const blockedDatesError = validateBlockedDatesInput(blockedDates);
    if (blockedDatesError) {
      setSaveError(blockedDatesError);
      setSaveSuccess("");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const available = await isSlugAvailable(normalizedSlug, user?.uid);
      if (!available) {
        setSlugError("Este slug ja esta em uso.");
        setSaveError("Escolha outro slug publico.");
        return;
      }

      await updateProfile({
        barbershopName: trimmedName,
        slug: normalizedSlug,
        phone: trimmedPhone,
        bio: trimmedBio,
        logoUrl: trimmedLogoUrl,
        businessHours: normalizedBusinessHours,
        blockedDates: normalizedBlockedDates,
        profileComplete: true,
        updatedAt: new Date(),
      });

      setSlug(normalizedSlug);
      setSaveSuccess("Perfil da barbearia salvo com sucesso.");
      trackEvent("profile_settings_saved", { source: "profile-settings", action: "save-profile" });
    } catch (error) {
      reportError(error, { source: "profile-settings", action: "save-profile" });
      if (error.message === "slug-unavailable") {
        setSlugError("Este slug acabou de ser reservado por outra conta.");
        setSaveError("Escolha outro slug publico.");
      } else {
        setSaveError("Erro ao salvar o perfil. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = () => {
    try {
      const generatedAt = new Date();
      const payload = createWorkspaceExportPayload(
        {
          owner: { uid: user?.uid, email: user?.email },
          profile,
          ...workspaceData,
        },
        { generatedAt }
      );
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = createWorkspaceExportFilename(profile, generatedAt);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setSaveError("");
      setSaveSuccess("Exportacao de dados gerada com sucesso.");
      trackEvent("workspace_data_exported", { source: "profile-settings", action: "export-data" });
    } catch (error) {
      reportError(error, { source: "profile-settings", action: "export-data" });
      setSaveSuccess("");
      setSaveError("Nao foi possivel exportar os dados agora.");
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Perfil publico</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Configuracoes da barbearia</h2>
            <p className="mt-2 max-w-2xl text-gray-400">
              Edite os dados exibidos no link publico e no painel da sua equipe.
            </p>
          </div>
          {previewUrl && (
            <a
              href={`/${normalizedSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              Abrir pagina publica
            </a>
          )}
        </div>

        {isSetupMode && (
          <div className="flex flex-col gap-3 rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">Etapa de ativacao</p>
              <h2 className="mt-2 text-xl font-bold">{setupCopy.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-300">{setupCopy.description}</p>
            </div>
            {profile?.profileComplete && profile?.businessHours?.start && profile?.businessHours?.end && (
              <Link
                to="/servicos?setup=services"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
              >
                Ir para servicos
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6 lg:p-8">
            <div className="grid gap-5">
              <label className="block">
                <span className="text-sm text-gray-300">Nome da barbearia</span>
                <input
                  value={barbershopName}
                  maxLength={PROFILE_LIMITS.nameMax}
                  autoComplete="organization"
                  onChange={(event) => setBarbershopName(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 text-white outline-none transition placeholder:text-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Ex: Barbearia Central"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Slug publico</span>
                <div className="mt-2 flex flex-col gap-2 rounded-3xl border border-gray-800 bg-gray-950 p-4 transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 sm:flex-row sm:items-center">
                  <span className="shrink-0 break-all text-gray-500">{window.location.origin}/</span>
                  <input
                    value={slug}
                    maxLength={PROFILE_LIMITS.slugMax}
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    onBlur={handleSlugBlur}
                    onChange={handleSlugChange}
                    className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-gray-500"
                    placeholder="nome-da-barbearia"
                  />
                </div>
                <div className="mt-2 min-h-5 text-sm">
                  {slugChecking && (
                    <p className="text-indigo-300" role="status" aria-live="polite">
                      Verificando disponibilidade...
                    </p>
                  )}
                  {slugError && (
                    <p className="text-red-400" role="alert" aria-live="assertive">
                      {slugError}
                    </p>
                  )}
                  {!slugChecking && !slugError && normalizedSlug && (
                    <p className="text-green-300" role="status" aria-live="polite">
                      Slug disponivel: {previewUrl}
                    </p>
                  )}
                </div>
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Telefone</span>
                <input
                  value={phone}
                  maxLength={PROFILE_LIMITS.phoneMax}
                  inputMode="tel"
                  autoComplete="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 text-white outline-none transition placeholder:text-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="(11) 98765-4321"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Bio</span>
                <textarea
                  value={bio}
                  maxLength={PROFILE_LIMITS.bioMax}
                  onChange={(event) => setBio(event.target.value)}
                  className="mt-2 min-h-[160px] w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 text-white outline-none transition placeholder:text-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Conte em poucas linhas o estilo, especialidades e experiencia da sua barbearia."
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-300">Logo URL opcional</span>
                <input
                  type="url"
                  value={logoUrl}
                  maxLength={PROFILE_LIMITS.urlMax}
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(event) => {
                    setLogoUrl(event.target.value);
                    setSaveError("");
                    setSaveSuccess("");
                  }}
                  className="mt-2 w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 text-white outline-none transition placeholder:text-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="https://..."
                />
                <p className="mt-2 text-xs text-gray-500">
                  Use uma imagem HTTPS para evitar bloqueios no navegador e manter sua pagina publica segura.
                </p>
              </label>

              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-5">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-white">Horario de funcionamento</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Usado para gerar horarios disponiveis na pagina publica.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-sm text-gray-300">Abre as</span>
                    <input
                      type="time"
                      value={businessHours.start}
                      onChange={(event) =>
                        setBusinessHours((current) => ({ ...current, start: event.target.value }))
                      }
                      className="mt-2 w-full rounded-2xl border border-gray-800 bg-gray-900 p-3 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-300">Fecha as</span>
                    <input
                      type="time"
                      value={businessHours.end}
                      onChange={(event) =>
                        setBusinessHours((current) => ({ ...current, end: event.target.value }))
                      }
                      className="mt-2 w-full rounded-2xl border border-gray-800 bg-gray-900 p-3 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {businessHours.end <= businessHours.start && (
                      <p className="mt-2 text-xs text-yellow-300">Fechamento deve ser depois da abertura.</p>
                    )}
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-300">Intervalo</span>
                    <select
                      value={businessHours.slotInterval}
                      onChange={(event) =>
                        setBusinessHours((current) => ({
                          ...current,
                          slotInterval: Number(event.target.value),
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-gray-800 bg-gray-900 p-3 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-5">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-white">Folgas e bloqueios</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Datas bloqueadas ficam indisponiveis na pagina publica.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="date"
                    min={formatLocalDate()}
                    value={blockedDateInput}
                    onChange={(event) => setBlockedDateInput(event.target.value)}
                    className="min-w-0 flex-1 rounded-2xl border border-gray-800 bg-gray-900 p-3 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!blockedDateInput) return;
                      if (!isValidDateString(blockedDateInput)) {
                        setSaveError("Escolha uma data valida para bloquear.");
                        setSaveSuccess("");
                        return;
                      }
                      setBlockedDates((current) =>
                        current.includes(blockedDateInput)
                          ? current
                          : normalizeBlockedDates([...current, blockedDateInput])
                      );
                      setSaveError("");
                      setBlockedDateInput("");
                    }}
                    disabled={blockedDates.length >= BUSINESS_HOURS_LIMITS.blockedDatesMax}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
                  >
                    Bloquear data
                  </button>
                </div>
                {blockedDates.length >= BUSINESS_HOURS_LIMITS.blockedDatesMax && (
                  <p className="mt-3 text-sm text-yellow-300">
                    Limite de {BUSINESS_HOURS_LIMITS.blockedDatesMax} datas bloqueadas atingido.
                  </p>
                )}

                {blockedDates.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">Nenhuma data bloqueada.</p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {blockedDates.map((blockedDate) => (
                      <button
                        key={blockedDate}
                        type="button"
                        onClick={() =>
                          setBlockedDates((current) => current.filter((item) => item !== blockedDate))
                        }
                        className="rounded-full border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-red-200"
                        title="Clique para remover"
                      >
                        {blockedDate}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-gray-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-5 text-sm">
                {saveError && (
                  <p className="text-red-400" role="alert" aria-live="assertive">
                    {saveError}
                  </p>
                )}
                {saveSuccess && (
                  <p className="text-green-400" role="status" aria-live="polite">
                    {saveSuccess}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={saving || slugChecking}
                aria-busy={saving ? "true" : "false"}
                className="inline-flex items-center justify-center rounded-3xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar configuracoes"}
              </button>
            </div>
          </section>

          <aside className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6 lg:p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Previa</p>
            <div className="mt-5 rounded-3xl border border-gray-800 bg-gray-950 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 text-lg font-black text-indigo-200">
                  <span>{(barbershopName.trim() || "B").slice(0, 1).toUpperCase()}</span>
                  {logoUrl.trim() ? (
                    <img
                      src={logoUrl.trim()}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                      className="absolute h-14 w-14 rounded-2xl object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Identidade visual</p>
                  <p className="mt-1 truncate text-sm text-gray-300">
                    {logoUrl.trim() ? "Logo configurada" : "Logo opcional"}
                  </p>
                </div>
              </div>
              <p className="text-xl font-bold text-white">{barbershopName.trim() || "Sua barbearia"}</p>
              <p className="mt-2 break-all text-sm text-indigo-300">
                {normalizedSlug ? `/${normalizedSlug}` : "/seu-slug"}
              </p>
              <p className="mt-4 text-sm text-gray-400">{phone.trim() || "Telefone ainda nao informado"}</p>
              <p className="mt-4 text-sm leading-6 text-gray-300">
                {bio.trim() || "Adicione uma bio curta para aparecer na pagina publica."}
              </p>
              <p className="mt-4 text-sm text-gray-400">
                Agenda: {businessHours.start} - {businessHours.end}, grade de {formatDuration(businessHours.slotInterval)}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {blockedDates.length} data(s) bloqueada(s)
              </p>
            </div>
            <div className="mt-5 rounded-3xl border border-gray-800 bg-gray-950 p-5 text-sm text-gray-400">
              <p className="font-semibold text-white">Checklist publico</p>
              <div className="mt-4 grid gap-2">
                <p>{barbershopName.trim() ? "OK Nome informado" : "Pendente Nome da barbearia"}</p>
                <p>{normalizedSlug ? "OK Slug configurado" : "Pendente Slug publico"}</p>
                <p>{phone.trim() ? "OK Telefone informado" : "Pendente Telefone"}</p>
                <p>{bio.trim() ? "OK Bio publicada" : "Opcional Bio publica"}</p>
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-gray-800 bg-gray-950 p-5 text-sm text-gray-400">
              <p className="font-semibold text-white">Dados da conta</p>
              <p className="mt-2 leading-6">
                Gere um arquivo JSON com perfil, agenda, clientes, servicos, equipe e auditoria carregados no painel.
              </p>
              <div className="mt-4 rounded-2xl border border-yellow-700/60 bg-yellow-950/30 p-4 text-yellow-100">
                <p className="font-semibold">Backup com dados pessoais</p>
                <p className="mt-2 leading-6">
                  O arquivo pode conter nomes, telefones e historico de atendimento. Salve apenas em local seguro e compartilhe somente com pessoas autorizadas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportData}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:border-indigo-400 hover:text-indigo-100"
              >
                Exportar dados
              </button>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}
