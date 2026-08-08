import { Component } from "react";
import { Link } from "react-router-dom";
import { reportError } from "../utils/telemetry";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, {
      source: "error-boundary",
      action: info?.componentStack ? "react-render" : "unknown",
    });
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <section
          className="w-full max-w-xl rounded-3xl border border-red-900/60 bg-gray-900 p-8 shadow-sm"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-red-300">Erro inesperado</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Nao foi possivel carregar esta tela</h1>
          <p className="mt-4 text-gray-400">
            O BarberOS encontrou uma falha nesta rota. Seus dados nao foram apagados; tente recarregar ou volte ao painel.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              aria-label="Recarregar o BarberOS"
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              Recarregar
            </button>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-gray-700 bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:border-gray-500"
            >
              Voltar ao dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }
}
