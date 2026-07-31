export const TRIAL_DAYS = 30;
export const DEFAULT_PLAN = "trial";
export const DEFAULT_SUBSCRIPTION_STATUS = "trialing";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function createTrialEndDate(startDate = new Date()) {
  return new Date(startDate.getTime() + TRIAL_DAYS * DAY_IN_MS);
}

export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getTrialDaysRemaining(profile, now = new Date()) {
  const trialEndsAt = toDate(profile?.trialEndsAt);
  if (!trialEndsAt) return null;

  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_IN_MS));
}

export function isSubscriptionActive(profile, now = new Date()) {
  const status = profile?.subscriptionStatus;
  if (status !== "active") return false;

  const subscriptionEndsAt = toDate(profile?.subscriptionEndsAt);
  return !subscriptionEndsAt || subscriptionEndsAt.getTime() > now.getTime();
}

export function getAccountAccess(profile, now = new Date()) {
  if (!profile) {
    return {
      active: false,
      status: "missing_profile",
      label: "Perfil pendente",
      plan: DEFAULT_PLAN,
      trialDaysRemaining: null,
    };
  }

  const plan = profile.plan || DEFAULT_PLAN;
  const subscriptionStatus = profile.subscriptionStatus || DEFAULT_SUBSCRIPTION_STATUS;
  const trialDaysRemaining = getTrialDaysRemaining(profile, now);
  const trialEndsAt = toDate(profile?.trialEndsAt);

  if (isSubscriptionActive(profile, now)) {
    return {
      active: true,
      status: "active",
      label: "Assinatura ativa",
      plan,
      trialDaysRemaining,
    };
  }

  if (!trialEndsAt) {
    return {
      active: true,
      status: "legacy_active",
      label: "Conta ativa",
      plan,
      trialDaysRemaining,
    };
  }

  if (trialEndsAt.getTime() > now.getTime()) {
    return {
      active: true,
      status: "trialing",
      label: "Teste gratuito",
      plan: "trial",
      trialDaysRemaining,
    };
  }

  const blockedStatus = ["past_due", "cancelled"].includes(subscriptionStatus)
    ? subscriptionStatus
    : "trial_expired";

  return {
    active: false,
    status: blockedStatus,
    label:
      blockedStatus === "past_due"
        ? "Pagamento pendente"
        : blockedStatus === "cancelled"
        ? "Assinatura cancelada"
        : "Trial expirado",
    plan,
    trialDaysRemaining: 0,
  };
}

export function isAccountActive(profile, now = new Date()) {
  return getAccountAccess(profile, now).active;
}

export function isTrialActive(profile, now = new Date()) {
  const trialEndsAt = toDate(profile?.trialEndsAt);
  if (!trialEndsAt) return true;

  return trialEndsAt.getTime() > now.getTime();
}
