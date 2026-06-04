import { Link } from "react-router-dom";

const benefits = [
  "Agendamento online",
  "Multi barbeiro",
  "Lembretes pelo WhatsApp",
  "Controle de clientes",
  "Financeiro simples",
  "Pagina publica personalizada",
];

const features = [
  "Agenda centralizada com status de cada horario",
  "Cadastro de servicos, precos e clientes",
  "Equipe com multiplos barbeiros por barbearia",
  "Link publico para receber reservas sem depender de mensagens manuais",
  "Modelos de WhatsApp para confirmacao e retorno",
  "Trial gratuito de 30 dias sem gateway de pagamento",
];

const faqs = [
  {
    question: "O BarberOS funciona para barbearias com mais de um barbeiro?",
    answer: "Sim. A estrutura foi pensada para equipes multi-barbeiro, com cada agendamento ligado ao profissional responsavel.",
  },
  {
    question: "Preciso instalar algum app?",
    answer: "Nao. O BarberOS roda no navegador e pode ser acessado pelo computador, tablet ou celular.",
  },
  {
    question: "Meus clientes conseguem agendar sozinhos?",
    answer: "Sim. Cada barbearia tem uma pagina publica personalizada para receber agendamentos online.",
  },
  {
    question: "Ja existe pagamento integrado?",
    answer: "Ainda nao. O plano atual inclui trial gratuito, e o gateway pode ser conectado depois.",
  },
];

const screenshots = [
  {
    title: "Dashboard operacional",
    description: "Resumo da barbearia, agenda ativa, clientes e faturamento em uma visao rapida.",
    image: "/screenshots/dashboard.png",
  },
  {
    title: "Agendamento publico",
    description: "Pagina para clientes escolherem barbeiro, servico, data e horario disponivel.",
    image: "/screenshots/agendamento.png",
  },
  {
    title: "Configuracao profissional",
    description: "Perfil publico, link personalizado e estrutura pronta para operacao multi-barbeiro.",
    image: "/screenshots/config.png",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-gray-950 text-white">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <a href="#topo" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500 text-lg font-black text-white">
              B
            </span>
            <span className="text-xl font-bold tracking-tight">BarberOS</span>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-gray-300 md:flex">
            <a href="#beneficios" className="transition hover:text-white">Beneficios</a>
            <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
            <a href="#recursos" className="transition hover:text-white">Recursos</a>
            <a href="#precos" className="transition hover:text-white">Precos</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:text-white"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="hidden rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200 sm:inline-flex"
            >
              Comecar gratis
            </Link>
          </div>
        </div>
      </header>

      <section
        id="topo"
        className="relative flex min-h-[88vh] items-center bg-cover bg-center px-5 pb-20 pt-32 md:px-8"
        style={{ backgroundImage: "linear-gradient(90deg, rgba(3,7,18,0.96), rgba(3,7,18,0.82), rgba(3,7,18,0.38)), url('/screenshots/agendamento.png')" }}
      >
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              SaaS para barbearias modernas
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-7xl">
              Organize sua agenda e receba agendamentos online
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-300">
              BarberOS centraliza agenda, equipe, clientes, WhatsApp e financeiro em um painel escuro, rapido e pronto para barbearias que querem operar com mais controle.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-950/40 transition hover:opacity-95"
              >
                Comecar gratis
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/10"
              >
                Ver como funciona
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="px-5 py-20 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Beneficios</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Tudo que o dono da barbearia precisa ver de relance</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
                <div className="mb-5 h-10 w-10 rounded-2xl bg-indigo-500/15" />
                <h3 className="text-xl font-semibold">{benefit}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-400">
                  Operacao mais organizada, menos tarefas manuais e uma experiencia mais clara para clientes e equipe.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-gray-800 bg-gray-900/60 px-5 py-20 md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Como funciona</p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {["Cadastre sua barbearia", "Configure equipe e servicos", "Compartilhe seu link publico"].map((step, index) => (
              <div key={step} className="rounded-3xl border border-gray-800 bg-gray-950 p-7">
                <span className="text-sm font-semibold text-indigo-300">0{index + 1}</span>
                <h3 className="mt-5 text-2xl font-bold">{step}</h3>
                <p className="mt-4 text-gray-400">
                  Em poucos minutos sua operacao fica pronta para receber, organizar e acompanhar agendamentos online.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="recursos" className="px-5 py-20 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Recursos</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Um sistema enxuto para rotina real de barbearia</h2>
            <p className="mt-5 text-gray-400">
              Sem telas desnecessarias. BarberOS prioriza agenda, atendimento, equipe, cliente e receita.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature} className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-gray-300">
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-900/50 px-5 py-20 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Preview</p>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl">Veja o BarberOS em acao</h2>
            </div>
            <Link to="/register" className="w-fit rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-gray-200">
              Testar agora
            </Link>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {screenshots.map((item) => (
              <article key={item.title} className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
                <img src={item.image} alt={item.title} className="aspect-[4/3] w-full object-cover object-top" />
                <div className="p-6">
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-400">{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="precos" className="px-5 py-20 md:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-8 text-center md:p-12">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Pricing</p>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">Comece com 30 dias gratis</h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            Teste agenda online, multi-barbeiro, pagina publica e WhatsApp sem gateway de pagamento configurado.
          </p>
          <Link to="/register" className="mt-8 inline-flex rounded-2xl bg-white px-6 py-4 text-sm font-bold text-black transition hover:bg-gray-200">
            Comecar gratis
          </Link>
        </div>
      </section>

      <section className="border-y border-gray-800 bg-gray-900/60 px-5 py-20 md:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">FAQ</p>
          <div className="mt-8 grid gap-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                <summary className="cursor-pointer text-lg font-semibold">{faq.question}</summary>
                <p className="mt-4 text-gray-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 text-center md:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-black md:text-5xl">Pronto para organizar sua barbearia?</h2>
          <p className="mt-5 text-gray-400">
            Leve sua agenda, equipe e pagina publica para um sistema criado para a rotina de barbearias.
          </p>
          <Link to="/register" className="mt-8 inline-flex rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 py-4 text-sm font-bold text-white transition hover:opacity-95">
            Comecar gratis
          </Link>
        </div>
      </section>
    </main>
  );
}
