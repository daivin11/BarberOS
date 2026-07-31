import { addLocalDays, formatLocalDate } from "./date.js";

export const APPOINTMENT_WINDOW_LIMITS = {
  pastDays: 365,
  futureDays: 180,
};

export const createAppointmentDateWindow = ({ today = formatLocalDate(), pastDays, futureDays } = {}) => {
  const safePastDays = Number.isFinite(Number(pastDays)) ? Number(pastDays) : APPOINTMENT_WINDOW_LIMITS.pastDays;
  const safeFutureDays = Number.isFinite(Number(futureDays)) ? Number(futureDays) : APPOINTMENT_WINDOW_LIMITS.futureDays;

  return {
    startDate: addLocalDays(today, -Math.max(0, safePastDays)),
    endDate: addLocalDays(today, Math.max(0, safeFutureDays)),
  };
};

export const getAppointmentWindowLabel = ({ startDate, endDate }) => {
  if (!startDate || !endDate) return "Janela operacional nao definida";
  return `Agendamentos carregados de ${startDate} ate ${endDate}.`;
};

export const getAppointmentWindowMonthBounds = ({ startDate, endDate } = createAppointmentDateWindow()) => ({
  startMonth: String(startDate || "").slice(0, 7),
  endMonth: String(endDate || "").slice(0, 7),
});

export const isMonthWithinAppointmentWindow = (month, window = createAppointmentDateWindow()) => {
  const { startMonth, endMonth } = getAppointmentWindowMonthBounds(window);
  return Boolean(month && startMonth && endMonth && month >= startMonth && month <= endMonth);
};

export const isDateWithinAppointmentWindow = (date, window = createAppointmentDateWindow()) =>
  Boolean(date && window?.startDate && window?.endDate && date >= window.startDate && date <= window.endDate);