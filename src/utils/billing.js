export const PLAN_LABELS = {
  trial: "Trial",
  starter: "Starter",
  studio: "Studio",
  pro: "Pro",
};

export const ALLOWED_PLANS = Object.keys(PLAN_LABELS);

export const BILLING_PLANS = [
  {
    id: "starter",
    label: PLAN_LABELS.starter,
    price: "R$ 49/mes",
    description: "Para barbeiro solo validando agenda online.",
    features: ["Agenda online", "Clientes", "Servicos", "WhatsApp"],
  },
  {
    id: "studio",
    label: PLAN_LABELS.studio,
    price: "R$ 89/mes",
    description: "Para barbearias com equipe e operacao recorrente.",
    features: ["Tudo do Starter", "Equipe", "Financeiro", "Auditoria"],
    recommended: true,
  },
  {
    id: "pro",
    label: PLAN_LABELS.pro,
    price: "R$ 149/mes",
    description: "Para operacoes que precisam de mais controle e suporte.",
    features: ["Tudo do Studio", "Prioridade no suporte", "Exportacao de dados", "Preparado para escala"],
  },
];

export const BILLING_STATUS_LABELS = {
  missing_profile: "Perfil pendente",
  legacy_active: "Conta ativa",
  trialing: "Teste gratuito",
  active: "Assinatura ativa",
  past_due: "Pagamento pendente",
  cancelled: "Assinatura cancelada",
  trial_expired: "Trial expirado",
};

export const RENEWAL_REQUEST_STATUSES = ["trial_expired", "past_due", "cancelled"];

export const getPlanLabel = (plan = "trial") => PLAN_LABELS[plan] || String(plan || "trial");

export const getBillingStatusLabel = (status) =>
  BILLING_STATUS_LABELS[status] || BILLING_STATUS_LABELS.trial_expired;

export const getRenewalRequestStatus = (status) =>
  RENEWAL_REQUEST_STATUSES.includes(status) ? status : "trial_expired";

export const getRenewalRequestPlan = (plan) =>
  ALLOWED_PLANS.includes(plan) ? plan : "trial";

export const createRenewalRequestId = (userId) =>
  String(userId || "").replace(/[^a-zA-Z0-9_-]/g, "_");

export const getBlockedAccountContent = (accountAccess = {}) => {
  switch (accountAccess.status) {
    case "past_due":
      return {
        title: "Existe uma pendencia na sua assinatura",
        description:
          "O acesso ao painel BarberOS foi pausado porque a assinatura esta com pagamento pendente.",
        referenceLabel: "Vencimento",
        nextStepTitle: "Regularize a assinatura",
        nextStepDescription:
          "Fale com o suporte para reativar o acesso. Seus dados continuam preservados e a liberacao deve acontecer assim que o pagamento for confirmado.",
        actionLabel: "Solicitar regularizacao",
      };
    case "cancelled":
      return {
        title: "Sua assinatura foi cancelada",
        description:
          "O acesso ao painel BarberOS foi pausado porque a assinatura desta conta esta cancelada.",
        referenceLabel: "Referencia",
        nextStepTitle: "Reative a conta",
        nextStepDescription:
          "Solicite a reativacao para voltar a usar agenda, clientes, equipe e financeiro com os dados preservados.",
        actionLabel: "Solicitar reativacao",
      };
    default:
      return {
        title: "Seu teste gratuito terminou",
        description:
          "O acesso ao painel BarberOS foi pausado porque o periodo gratuito de 30 dias chegou ao fim.",
        referenceLabel: "Fim do trial",
        nextStepTitle: "Solicite a renovacao da sua conta",
        nextStepDescription:
          "Fale com o suporte para escolher a melhor forma de continuar ou envie uma solicitacao interna para registrarmos seu interesse. A reativacao acontece assim que a continuidade da conta for confirmada.",
        actionLabel: "Solicitar renovacao",
      };
  }
};

export const createRenewalRequestPayload = ({
  userId,
  profile = {},
  accountAccess = {},
  requestedPlan,
  now = new Date(),
}) => {
  const cleanUserId = createRenewalRequestId(userId);
  const barbershopName =
    String(profile?.barbershopName || profile?.displayName || "Barbearia").trim() || "Barbearia";

  return {
    userId: cleanUserId,
    barbershopName,
    accountStatus: getRenewalRequestStatus(accountAccess.status),
    plan: getRenewalRequestPlan(accountAccess.plan),
    requestedPlan: getRenewalRequestPlan(requestedPlan || accountAccess.plan || "studio"),
    timestamp: now,
    status: "pending",
    createdAt: now,
  };
};
