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
    to: "/perfil",
  },
  {
    id: "hours",
    label: "Definir horarios",
    description: "Horario de funcionamento e intervalo geram a grade de agendamento correta.",
    impact: "Evita horarios impossiveis no link publico.",
    actionLabel: "Configurar horarios",
    done: Boolean(profile?.businessHours?.start && profile?.businessHours?.end),
    to: "/perfil",
  },
  {
    id: "services",
    label: "Cadastrar servico",
    description: "Servicos com preco e duracao dizem ao cliente o que ele esta marcando.",
    impact: "Sem servico publicado, o cliente nao consegue agendar.",
    actionLabel: "Adicionar servico",
    done: servicesCount > 0,
    to: "/servicos",
  },
  {
    id: "barbers",
    label: "Cadastrar equipe",
    description: "Pelo menos um profissional precisa aparecer na agenda interna e publica.",
    impact: "Permite separar agenda por barbeiro.",
    actionLabel: "Adicionar barbeiro",
    done: barbersCount > 0,
    to: "/barbeiros",
  },
  {
    id: "first-booking",
    label: "Criar primeiro agendamento",
    description: "Um agendamento real valida cliente, servico, horario, barbeiro e status.",
    impact: "Confirma que o fluxo operacional esta funcionando.",
    actionLabel: "Criar agendamento",
    done: appointmentsCount > 0,
    to: "/agenda",
  },
  {
    id: "clients",
    label: "Cadastrar primeiro cliente",
    description: "A base de clientes alimenta historico, retorno e campanhas pelo WhatsApp.",
    impact: "Ajuda a operar alem dos agendamentos publicos.",
    actionLabel: "Adicionar cliente",
    done: clientsCount > 0,
    to: "/clientes",
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
