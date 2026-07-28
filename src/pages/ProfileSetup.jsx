import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

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

  useEffect(() => {
    if (profile) {
      setBarbershopName(profile.barbershopName || "");
      setSlug(profile.slug || "");
      setPhone(profile.phone || "");
      setBio(profile.bio || "");
      setLogoUrl(profile.logoUrl || "");
    }
  }, [profile]);

  // keep previewUrl in sync with slug input
  useEffect(() => {
    const normalized = normalizeSlug(slug || "");
    setPreviewUrl(normalized ? `${window.location.origin}/${normalized}` : "");
  }, [slug]);

  // debounce slug availability checks while typing
  useEffect(() => {
    if (!slug) {
      setSlugError("");
      setSlugChecking(false);
      return;
    }

    let mounted = true;
    const normalized = normalizeSlug(slug);
    setSlugChecking(true);
    const t = setTimeout(async () => {
      try {
        const available = await isSlugAvailable(normalized, user?.uid);
        if (!mounted) return;
        setSlugError(available ? "" : "Este endereço já está em uso.");
      } catch (err) {
        if (!mounted) return;
        console.error(err);
        setSlugError("Erro ao verificar disponibilidade.");
      } finally {
        if (mounted) {
          setSlugChecking(false);
        }
      }
    }, 600);

    return () => {
      mounted = false;
      clearTimeout(t);
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
      setSlugError("O slug não pode ficar vazio.");
      return;
    }

    if (normalized !== slug) {
      setSlug(normalized);
    }

    setSlugChecking(true);
    const available = await isSlugAvailable(normalized, user?.uid);
    setSlugChecking(false);
    setSlugError(available ? "" : "Este endereço já está em uso.");
  };

  function normalizeSlug(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]+/g, "")
      .replace(/(^-|-$)/g, "");
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!barbershopName || !slug || !phone) {
      setSaveError("Preencha nome, slug e telefone para continuar.");
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
      const normalized = normalizeSlug(slug);
      const available = await isSlugAvailable(normalized, user?.uid);
      if (!available) {
        setSlugError("Este endereço já está em uso.");
        setSaveError("Escolha outro slug público.");
        setLoading(false);
        return;
      }

      await updateProfile({
        barbershopName,
        slug: normalized,
        phone,
        bio,
        logoUrl,
        profileComplete: true,
      });
      setSaveSuccess("Perfil salvo com sucesso!");
      // small delay so user can see success message
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (err) {
      console.error(err);
      setSaveError("Erro ao salvar o perfil. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-10 text-gray-400">Carregando perfil...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="min-h-screen grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="hidden xl:flex flex-col justify-center px-16 py-20 bg-gradient-to-br from-gray-900 via-indigo-900 to-black">
          <div className="max-w-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-full p-3 shadow-md">
                <span className="text-2xl">💈</span>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Perfil</p>
                <h2 className="text-3xl font-bold">Configure seu espaço</h2>
              </div>
            </div>

            <p className="text-gray-300 text-lg leading-relaxed">
              Defina seu nome de barbearia, única URL pública, telefone, bio e logo para que seus clientes possam agendar com você.
            </p>

            <div className="grid gap-4 text-gray-300">
              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Perfil público</p>
                <p className="mt-3 text-base">Seu horário público ficará disponível em:</p>
                <p className="mt-2 text-white font-semibold">/seu-slug-aqui</p>
              </div>
              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Melhore sua conversão</p>
                <p className="mt-3 text-base">Use uma descrição curta para que seus clientes entendam o estilo da sua barbearia.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-2xl">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-3xl border border-gray-800 p-10 shadow-xl">
              <div className="mb-8">
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-400">Configuração de perfil</p>
                <h1 className="mt-3 text-3xl font-bold">Complete seu perfil BarberOS</h1>
                <p className="text-gray-400 mt-3 max-w-2xl">
                  Configure sua barbearia para começar a receber agendamentos públicos.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="group">
                    <span className="text-sm text-gray-300">Nome da barbearia</span>
                    <input
                      value={barbershopName}
                      onChange={(e) => setBarbershopName(e.target.value)}
                      className="mt-2 w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Ex: Barbearia Central"
                    />
                  </label>

                  <label className="group">
                    <span className="text-sm text-gray-300">Telefone</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-2 w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="(11) 98765-4321"
                    />
                  </label>
                </div>

                <label className="group">
                  <span className="text-sm text-gray-300">URL pública</span>
                  <div className="mt-2 flex items-center gap-3 rounded-3xl border border-gray-800 bg-gray-950 px-4 py-3">
                    <span className="text-gray-500">barberos.app/</span>
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      onBlur={handleSlugBlur}
                      className="flex-1 bg-transparent outline-none text-white placeholder:text-gray-500"
                      placeholder="nome-da-barbearia"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Use letras, números e hífens. Evite espaços e caracteres especiais.
                  </p>
                  {previewUrl && (
                    <p className="mt-2 text-sm text-indigo-300">Pré-visualização: <span className="font-mono text-sm text-indigo-100">{previewUrl}</span></p>
                  )}
                  {slugChecking && <p className="mt-2 text-sm text-indigo-300">Verificando disponibilidade...</p>}
                  {slugError && <p className="mt-2 text-sm text-red-400">{slugError}</p>}
                </label>

                <label className="group">
                  <span className="text-sm text-gray-300">Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="mt-2 w-full min-h-[140px] rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Fale um pouco sobre seu estilo e serviços..."
                  />
                </label>

                <label className="group">
                  <span className="text-sm text-gray-300">Logo URL (opcional)</span>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="mt-2 w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="https://..."
                  />
                </label>

                {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                {saveSuccess && <p className="text-sm text-green-400">{saveSuccess}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-3xl bg-gradient-to-r from-indigo-500 to-violet-500 py-4 text-white font-semibold shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
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
