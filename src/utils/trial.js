export const TRIAL_DAYS = 30;

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

export function isTrialActive(profile, now = new Date()) {
  const trialEndsAt = toDate(profile?.trialEndsAt);
  if (!trialEndsAt) return true;

  return trialEndsAt.getTime() > now.getTime();
}
