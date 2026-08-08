import { getAccountAccess } from "./trial.js";

export const getActivationItems = ({
  profile,
  servicesCount = 0,
  barbersCount = 0,
  clientsCount = 0,
  appointmentsCount = 0,
} = {}) => [
  {
    id: "profile",
    label: "Completar perfil publico",
    description: "Nome, telefone e URL publica deixam sua barbearia identificavel para clientes.",
    impact: "Libera a pagina publica da barbearia.",
    actionLabel: "Revisar perfil",
    done: Boolean(profile?.profileComplete && profile?.slug && profile?.barbershopName),
    to: "/perfil?setup=profile",
  },
  {
    id: "hours",
    label: "Definir horarios",
    description: "Horario de funcionamento e intervalo geram a grade de agendamento correta.",
    impact: "Evita horarios impossiveis no link publico.",
    actionLabel: "Configurar horarios",
    done: Boolean(profile?.businessHours?.start && profile?.businessHours?.end),
    to: "/perfil?setup=hours",
  },
  {
    id: "services",
    label: "Cadastrar servico",
    description: "Servicos com preco e duracao dizem ao cliente o que ele esta marcando.",
    impact: "Sem servico publicado, o cliente nao consegue agendar.",
    actionLabel: "Adicionar servico",
    done: servicesCount > 0,
    to: "/servicos?setup=services",
  },
  {
    id: "barbers",
    label: "Cadastrar equipe",
    description: "Pelo menos um profissional precisa aparecer na agenda interna e publica.",
    impact: "Permite separar agenda por barbeiro.",
    actionLabel: "Adicionar barbeiro",
    done: barbersCount > 0,
    to: "/barbeiros?setup=barbers",
  },
  {
    id: "clients",
    label: "Cadastrar primeiro cliente",
    description: "O agendamento interno precisa de um contato para guardar historico e telefone.",
    impact: "Evita travar na agenda por falta de cliente selecionavel.",
    actionLabel: "Adicionar cliente",
    done: clientsCount > 0,
    to: "/clientes?setup=clients",
  },
  {
    id: "first-booking",
    label: "Criar primeiro agendamento",
    description: "Um agendamento real valida cliente, servico, horario, barbeiro e status.",
    impact: "Confirma que o fluxo operacional esta funcionando.",
    actionLabel: "Criar agendamento",
    done: appointmentsCount > 0,
    to: "/agenda?setup=first-booking",
  },
];

export const getActivationState = (input = {}) => {
  const items = getActivationItems(input);
  const completedCount = items.filter((item) => item.done).length;
  const nextItem = items.find((item) => !item.done) || null;
  const progress = Math.round((completedCount / items.length) * 100);

  return {
    items,
    completedCount,
    totalCount: items.length,
    nextItem,
    progress,
    isActivated: completedCount === items.length,
  };
};

export const getPublicBookingReadiness = ({
  profile,
  servicesCount = 0,
  barbersCount = 0,
} = {}) => {
  const missing = [];
  const accountAccess = getAccountAccess(profile);

  if (profile && !accountAccess.active) {
    missing.push({
      id: "account",
      label: "Regularize a assinatura para reativar o link publico",
      to: "/dashboard",
    });
  }

  if (!profile?.profileComplete || !profile?.slug || !profile?.barbershopName) {
    missing.push({
      id: "profile",
      label: "Complete o perfil publico",
      to: "/perfil?setup=profile",
    });
  }

  if (!profile?.businessHours?.start || !profile?.businessHours?.end) {
    missing.push({
      id: "hours",
      label: "Defina horarios de funcionamento",
      to: "/perfil?setup=hours",
    });
  }

  if (servicesCount <= 0) {
    missing.push({
      id: "services",
      label: "Cadastre pelo menos um servico",
      to: "/servicos?setup=services",
    });
  }

  if (barbersCount <= 0) {
    missing.push({
      id: "barbers",
      label: "Cadastre pelo menos um barbeiro",
      to: "/barbeiros?setup=barbers",
    });
  }

  return {
    isReady: missing.length === 0,
    missing,
    nextStep: missing[0] || null,
  };
};
