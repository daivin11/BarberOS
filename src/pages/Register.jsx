import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getFriendlyAuthError } from "../utils/authErrors";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("As senhas nao coincidem.");
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password);
      navigate("/setup-profile");
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error, "Nao foi possivel criar sua conta. Tente novamente."));
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
                <span className="text-2xl font-black">B</span>
              </div>
              <h2 className="text-3xl font-bold">BarberOS</h2>
            </div>

            <h3 className="mb-4 text-4xl font-extrabold leading-tight">Bem-vindo ao BarberOS</h3>
            <p className="mb-6 text-gray-300">
              Crie sua conta e comece a gerenciar sua barbearia com uma interface limpa e profissional.
            </p>

            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-indigo-400">-</span>
                <span>Agenda simples e rapida</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-indigo-400">-</span>
                <span>Controle de clientes e servicos</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-indigo-400">-</span>
                <span>Mensagens pelo WhatsApp</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-gray-800 bg-gray-900/80 p-8 shadow-xl backdrop-blur-sm">
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Criar nova conta</h1>
                <p className="mt-2 text-gray-400">Abra sua conta BarberOS e gerencie sua barbearia em poucos passos.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-300">E-mail</span>
                  <input
                    className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-3 outline-none transition focus:border-indigo-500"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@barbearia.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setErrorMessage("");
                    }}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-300">Senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-3 outline-none transition focus:border-indigo-500"
                    placeholder="Crie uma senha"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrorMessage("");
                    }}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-300">Confirmar senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-3 outline-none transition focus:border-indigo-500"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setErrorMessage("");
                    }}
                  />
                </label>

                {errorMessage && (
                  <div className="rounded-2xl border border-red-700 bg-red-950/70 p-3 text-sm text-red-200" role="alert">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 font-semibold text-white shadow transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Cadastrando..." : "Criar conta"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-400">
                Ja tem conta?{" "}
                <Link to="/login" className="text-white underline">
                  Entrar
                </Link>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              <p>{new Date().getFullYear()} BarberOS - Design premium</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
