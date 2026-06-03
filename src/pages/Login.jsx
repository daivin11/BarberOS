import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      alert("Erro ao entrar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        {/* Left branding panel */}
        <div className="hidden md:flex flex-col justify-center px-12 py-16 bg-gradient-to-br from-gray-900 via-indigo-900 to-black">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-white/10 rounded-full p-3 shadow-md">
                <span className="text-2xl">💈</span>
              </div>
              <h2 className="text-3xl font-bold">BarberOS</h2>
            </div>

            <h3 className="text-4xl font-extrabold leading-tight mb-4">Gestão simples para barbearias</h3>
            <p className="text-gray-300 mb-6">Agenda, clientes, serviços e financeiro com uma interface limpa e rápida — tudo pronto para escalar sua barbearia.</p>

            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-indigo-400">•</span>
                <span>Agendamentos fáceis</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-indigo-400">•</span>
                <span>Templates de mensagem</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-indigo-400">•</span>
                <span>Relatórios simples</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right login panel */}
        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-3xl p-8 border border-gray-800 shadow-xl">
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Entrar na sua conta</h1>
                <p className="text-gray-400 mt-2">Acesse sua conta BarberOS para gerenciar sua barbearia.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-3 outline-none"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-3 outline-none"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white py-3 rounded-2xl font-semibold shadow hover:opacity-95 transition"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <div className="mt-6 text-center text-gray-400 text-sm">
                Não tem conta? <Link to="/register" className="text-white underline">Cadastre-se</Link>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              <p>© {new Date().getFullYear()} BarberOS — Design premium</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
