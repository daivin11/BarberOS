import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      navigate("/setup-profile");
    } catch (err) {
      alert("Erro ao cadastrar: " + err.message);
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

            <h3 className="text-4xl font-extrabold leading-tight mb-4">Bem-vindo ao BarberOS</h3>
            <p className="text-gray-300 mb-6">Crie sua conta e comece a gerenciar sua barbearia com uma interface limpa e profissional.</p>

            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-indigo-400">•</span>
                <span>Agenda simples e rápida</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-indigo-400">•</span>
                <span>Controle de clientes e serviços</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-indigo-400">•</span>
                <span>Envio de mensagens pelo WhatsApp</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right register panel */}
        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-3xl p-8 border border-gray-800 shadow-xl transform transition-all duration-200 hover:scale-[1.01]">
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Criar nova conta</h1>
                <p className="text-gray-400 mt-2">Abra sua conta BarberOS e gerencie sua barbearia em poucos passos.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                  placeholder="Confirme a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white py-3 rounded-2xl font-semibold shadow hover:opacity-95 transition"
                >
                  {loading ? "Cadastrando..." : "Criar conta"}
                </button>
              </form>

              <div className="mt-6 text-center text-gray-400 text-sm">
                Já tem conta? <Link to="/login" className="text-white underline">Entrar</Link>
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
