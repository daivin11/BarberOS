import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { PROFILE_LIMITS, normalizeSlug, validatePublicProfileInput } from "../utils/profileValidation";
import { defaultBusinessHours, normalizeBusinessHours } from "../utils/schedule";
import { reportError, trackEvent } from "../utils/telemetry";

export default function ProfileSetup() {
  const { user, profile, profileLoading, updateProfile, isSlugAvailable } = useAuth();
  const navigate = useNavigate();
  const [barbershopName, setBarbershopName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [slugError, setSlugError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!profile) return;

    setBarbershopName(profile.barbershopName || "");
    setSlug(profile.slug || "");
    setPhone(profile.phone || "");
    setBio(profile.bio || "");
    setLogoUrl(profile.logoUrl || "");
  }, [profile]);

  useEffect(() => {
    const normalized = normalizeSlug(slug || "");
    setPreviewUrl(normalized ? `${publicOrigin}/${normalized}` : "");
  }, [slug, publicOrigin]);

  useEffect(() => {
    if (!slug) {
      setSlugError("");
      setSlugChecking(false);
      return;
    }

    let mounted = true;
    const normalized = normalizeSlug(slug);
    setSlugChecking(true);

    const timeout = setTimeout(async () => {
      try {
        const available = await isSlugAvailable(normalized, user?.uid);
        if (!mounted) return;
        setSlugError(available ? "" : "Este endereco ja esta em uso.");
      } catch (err) {
        if (!mounted) return;
        reportError(err, { source: "profile-setup", action: "check-slug" });
        setSlugError("Erro ao verificar disponibilidade.");
      } finally {
        if (mounted) setSlugChecking(false);
      }
    }, 600);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [slug, isSlugAvailable, user]);

  useEffect(() => {
    if (!user && !profileLoading) {
      navigate("/login", { replace: true });
    }
  }, [user, profileLoading, navigate]);

  const handleSlugBlur = async () => {
    const normalized = normalizeSlug(slug);
    if (!normalized) {
      setSlugError("O slug nao pode ficar vazio.");
      return;
    }

    if (normalized !== slug) setSlug(normalized);

    setSlugChecking(true);
    try {
      const available = await isSlugAvailable(normalized, user?.uid);
      setSlugError(available ? "" : "Este endereco ja esta em uso.");
    } catch (err) {
      reportError(err, { source: "profile-setup", action: "check-slug-blur" });
      setSlugError("Erro ao verificar disponibilidade.");
    } finally {
      setSlugChecking(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalized = normalizeSlug(slug);
    const trimmedName = barbershopName.trim();
    const trimmedPhone = phone.trim();
    const trimmedBio = bio.trim();
    const trimmedLogoUrl = logoUrl.trim();
    const validationError = validatePublicProfileInput({
      barbershopName: trimmedName,
      slug: normalized,
      phone: trimmedPhone,
      bio: trimmedBio,
      logoUrl: trimmedLogoUrl,
    });

    if (validationError) {
      setSaveError(validationError);
      return;
    }

    if (slugError) {
      setSaveError("Corrija o slug antes de continuar.");
      return;
    }

    setLoading(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const available = await isSlugAvailable(normalized, user?.uid);
      if (!available) {
        setSlugError("Este endereco ja esta em uso.");
        setSaveError("Escolha outro slug publico.");
        return;
      }

      await updateProfile({
        barbershopName: trimmedName,
        slug: normalized,
        phone: trimmedPhone,
        bio: trimmedBio,
        logoUrl: trimmedLogoUrl,
        businessHours: normalizeBusinessHours(defaultBusinessHours),
        profileComplete: true,
      });
      setSaveSuccess("Perfil salvo com sucesso.");
      trackEvent("profile_setup_completed", { source: "profile-setup", action: "save-profile" });
      window.setTimeout(() => navigate("/dashboard"), 900);
    } catch (err) {
      reportError(err, { source: "profile-setup", action: "save-profile" });
      if (err.message === "slug-unavailable") {
        setSlugError("Este endereco acabou de ser reservado por outra conta.");
        setSaveError("Escolha outro slug publico.");
      } else {
        setSaveError("Erro ao salvar o perfil. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-10 text-gray-400">
          Carregando perfil...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="hidden flex-col justify-center bg-gradient-to-br from-gray-900 via-indigo-900 to-black px-16 py-20 xl:flex">
          <div className="max-w-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/10 p-3 shadow-md">
                <span className="text-sm font-black text-white">B</span>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Perfil</p>
                <h2 className="text-3xl font-bold">Configure seu espaco</h2>
              </div>
            </div>

            <p className="text-lg leading-relaxed text-gray-300">
              Defina nome, URL publica, telefone, bio e logo para que seus clientes possam agendar com confianca.
            </p>

            <div className="grid gap-4 text-gray-300">
              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Link publico</p>
                <p className="mt-3 text-base">Seu agendamento ficara disponivel em:</p>
                <p className="mt-2 font-semibold text-white">/seu-slug-aqui</p>
              </div>
              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Conversao</p>
                <p className="mt-3 text-base">
                  Uma descricao curta ajuda o cliente a reconhecer sua barbearia antes de escolher o horario.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-2xl">
            <div className="rounded-3xl border border-gray-800 bg-gray-900/80 p-6 shadow-xl backdrop-blur-sm sm:p-10">
              <div className="mb-8">
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-400">Configuracao de perfil</p>
                <h1 className="mt-3 text-3xl font-bold">Complete seu perfil BarberOS</h1>
                <p className="mt-3 max-w-2xl text-gray-400">
                  Configure sua barbearia para comecar a receber agendamentos publicos.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="group">
                    <span className="text-sm text-gray-300">Nome da barbearia</span>
                    <input
                      value={barbershopName}
                      maxLength={PROFILE_LIMITS.nameMax}
                      onChange={(event) => setBarbershopName(event.target.value)}
                      className="mt-2 w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Ex: Barbearia Central"
                    />
                  </label>

                  <label className="group">
                    <span className="text-sm text-gray-300">Telefone</span>
                    <input
                      value={phone}
                      maxLength={PROFILE_LIMITS.phoneMax}
                      onChange={(event) => setPhone(event.target.value)}
                      className="mt-2 w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="(11) 98765-4321"
                    />
                  </label>
                </div>

                <label className="group">
                  <span className="text-sm text-gray-300">URL publica</span>
                  <div className="mt-2 flex items-center gap-3 rounded-3xl border border-gray-800 bg-gray-950 px-4 py-3">
                    <span className="min-w-0 break-all text-gray-500">{publicOrigin}/</span>
                    <input
                      value={slug}
                      maxLength={PROFILE_LIMITS.slugMax}
                      onChange={(event) => setSlug(event.target.value)}
                      onBlur={handleSlugBlur}
                      className="flex-1 bg-transparent text-white outline-none placeholder:text-gray-500"
                      placeholder="nome-da-barbearia"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Use letras, numeros e hifens. Evite espacos e caracteres especiais.
                  </p>
                  {previewUrl && (
                    <p className="mt-2 text-sm text-indigo-300">
                      Pre-visualizacao: <span className="font-mono text-sm text-indigo-100">{previewUrl}</span>
                    </p>
                  )}
                  {slugChecking && <p className="mt-2 text-sm text-indigo-300">Verificando disponibilidade...</p>}
                  {slugError && <p className="mt-2 text-sm text-red-400">{slugError}</p>}
                </label>

                <label className="group">
                  <span className="text-sm text-gray-300">Bio</span>
                  <textarea
                    value={bio}
                    maxLength={PROFILE_LIMITS.bioMax}
                    onChange={(event) => setBio(event.target.value)}
                    className="mt-2 min-h-[140px] w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Fale um pouco sobre seu estilo e servicos..."
                  />
                </label>

                <label className="group">
                  <span className="text-sm text-gray-300">Logo URL opcional</span>
                  <input
                    value={logoUrl}
                    maxLength={PROFILE_LIMITS.urlMax}
                    onChange={(event) => setLogoUrl(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="https://..."
                  />
                </label>

                {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                {saveSuccess && <p className="text-sm text-green-400">{saveSuccess}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-3xl bg-gradient-to-r from-indigo-500 to-violet-500 py-4 font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Salvando perfil..." : "Salvar perfil e ir para dashboard"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
