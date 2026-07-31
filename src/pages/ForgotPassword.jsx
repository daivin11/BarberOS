import { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../services/firebase";
import { getPasswordResetActionCodeSettings } from "../utils/authActions";
import { getFriendlyAuthError } from "../utils/authErrors";
import { reportError, trackEvent } from "../utils/telemetry";

const getFriendlyError = (error) => {
  switch (error?.code) {
    case "auth/invalid-email":
      return "Informe um e-mail valido.";
    case "auth/user-not-found":
      return "Nao encontramos uma conta com este e-mail.";
    case "auth/network-request-failed":
      return "Falha de conexao. Verifique sua internet e tente novamente.";
    default:
      return getFriendlyAuthError(error, "Nao foi possivel enviar o link agora. Tente novamente em alguns instantes.");
  }
};

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("Informe um e-mail valido.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(
        auth,
        email.trim(),
        getPasswordResetActionCodeSettings({
          origin: window.location.origin,
        })
      );
      setSuccessMessage("Enviamos um link para redefinir sua senha. Verifique seu e-mail.");
      setEmail("");
      trackEvent("password_reset_requested", { source: "forgot-password", action: "request-reset" });
    } catch (error) {
      reportError(error, { source: "forgot-password", action: "request-reset" });
      setErrorMessage(getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        <section className="hidden flex-col justify-center bg-gradient-to-br from-gray-900 via-indigo-900 to-black px-12 py-16 md:flex">
          <div className="max-w-lg">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-white/10 p-3 shadow-md">
                <span className="text-2xl">B</span>
              </div>
              <h2 className="text-3xl font-bold">BarberOS</h2>
            </div>
            <h1 className="mb-4 text-4xl font-extrabold leading-tight">
              Recupere o acesso ao painel da sua barbearia
            </h1>
            <p className="text-gray-300">
              Enviaremos um link seguro para o e-mail cadastrado na sua conta BarberOS.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-gray-800 bg-gray-900/80 p-8 shadow-xl backdrop-blur-sm">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Senha</p>
                <h1 className="mt-3 text-2xl font-bold">Redefinir senha</h1>
                <p className="mt-2 text-gray-400">
                  Digite seu e-mail para receber o link de redefinicao.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-300">E-mail da conta</span>
                  <input
                    className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@barbearia.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                {successMessage && (
                  <div className="rounded-2xl border border-emerald-700 bg-emerald-950/70 p-4 text-sm text-emerald-300" role="status">
                    {successMessage}
                  </div>
                )}

                {errorMessage && (
                  <div className="rounded-2xl border border-red-700 bg-red-950/70 p-4 text-sm text-red-300" role="alert">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 font-semibold text-white shadow transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Enviando..." : "Enviar link de redefinicao"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-400">
                Lembrou a senha?{" "}
                <Link to="/login" className="text-white underline">
                  Entrar
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
