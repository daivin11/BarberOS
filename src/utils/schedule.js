import { formatLocalDate } from "./date.js";

export const defaultBusinessHours = {
  start: "09:00",
  end: "18:00",
  slotInterval: 30,
};

export const BUSINESS_HOURS_LIMITS = {
  slotIntervals: [15, 30, 45, 60],
  blockedDatesMax: 120,
};

export const getSafeScheduleDuration = (duration, fallbackDuration = defaultBusinessHours.slotInterval) => {
  const value = Number(duration);
  const fallback = Number(fallbackDuration) || defaultBusinessHours.slotInterval;

  if (
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 15 &&
    value <= 240 &&
    value % 15 === 0
  ) {
    return value;
  }

  return fallback;
};

export const isValidTimeString = (value) => {
  if (!/^\d{2}:\d{2}$/.test(String(value || ""))) return false;
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

export const isValidDateString = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === value;
};

export const createSlotId = ({ userId, barberId, date, time }) =>
  `${userId}_${barberId}_${date}_${time}`.replace(/[^a-zA-Z0-9_-]/g, "_");

export const timeToMinutes = (value) => {
  if (!isValidTimeString(value)) return 0;

  const [hours = "0", minutes = "0"] = String(value || "00:00").split(":");
  return Number(hours) * 60 + Number(minutes);
};

export const minutesToTime = (value) => {
  const safeValue = Number(value);
  if (!Number.isFinite(safeValue) || !Number.isInteger(safeValue) || safeValue < 0 || safeValue >= 1440) {
    return "00:00";
  }

  const hours = Math.floor(safeValue / 60);
  const minutes = safeValue % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB;

export const isTimeSlotAvailable = ({ time, duration = 30, bookedSlots = [], interval } = {}) => {
  if (!isValidTimeString(time)) return false;

  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + getSafeScheduleDuration(duration, interval || defaultBusinessHours.slotInterval);

  return !bookedSlots.some((bookedSlot) => {
    const bookedStart = bookedSlot.startMinutes ?? timeToMinutes(bookedSlot.time);
    const bookedEnd = bookedSlot.endMinutes ?? bookedStart + getSafeScheduleDuration(bookedSlot.duration);
    return overlaps(slotStart, slotEnd, bookedStart, bookedEnd);
  });
};

export const getOccupiedTimes = ({ startMinutes, endMinutes, interval = defaultBusinessHours.slotInterval }) => {
  const safeStart = Number(startMinutes);
  const safeEnd = Number(endMinutes);
  const safeInterval = getSafeScheduleDuration(interval);

  if (
    !Number.isFinite(safeStart) ||
    !Number.isFinite(safeEnd) ||
    safeStart < 0 ||
    safeEnd <= safeStart ||
    safeStart >= 1440
  ) {
    return [];
  }

  const times = [];
  for (let current = safeStart; current < safeEnd && current < 1440; current += safeInterval) {
    times.push(minutesToTime(current));
  }
  return times;
};

export const getSlotInterval = (profileOrBusinessHours) =>
  Number(profileOrBusinessHours?.businessHours?.slotInterval || profileOrBusinessHours?.slotInterval) ||
  defaultBusinessHours.slotInterval;

export const normalizeBusinessHours = (businessHours = {}) => ({
  start: businessHours.start || defaultBusinessHours.start,
  end: businessHours.end || defaultBusinessHours.end,
  slotInterval: BUSINESS_HOURS_LIMITS.slotIntervals.includes(Number(businessHours.slotInterval))
    ? Number(businessHours.slotInterval)
    : defaultBusinessHours.slotInterval,
});

export const validateBusinessHoursInput = (businessHours = {}) => {
  const normalized = normalizeBusinessHours(businessHours);
  const rawSlotInterval = Number(businessHours.slotInterval);

  if (!isValidTimeString(normalized.start) || !isValidTimeString(normalized.end)) {
    return "Informe horarios validos de abertura e fechamento.";
  }

  if (timeToMinutes(normalized.end) <= timeToMinutes(normalized.start)) {
    return "O horario de fechamento precisa ser depois da abertura.";
  }

  if (!BUSINESS_HOURS_LIMITS.slotIntervals.includes(rawSlotInterval)) {
    return "Escolha um intervalo valido para a agenda.";
  }

  return "";
};

export const normalizeBlockedDates = (dates = []) =>
  [...new Set((Array.isArray(dates) ? dates : []).filter(isValidDateString))]
    .sort()
    .slice(0, BUSINESS_HOURS_LIMITS.blockedDatesMax);

export const validateBlockedDatesInput = (dates = []) => {
  if (!Array.isArray(dates)) return "A lista de datas bloqueadas esta invalida.";
  if (dates.length > BUSINESS_HOURS_LIMITS.blockedDatesMax) {
    return `Use no maximo ${BUSINESS_HOURS_LIMITS.blockedDatesMax} datas bloqueadas.`;
  }
  if (dates.some((date) => !isValidDateString(date))) {
    return "Remova datas bloqueadas invalidas antes de salvar.";
  }
  return "";
};

export const getTimeSlots = ({ businessHours = defaultBusinessHours, duration = 30 } = {}) => {
  const normalized = normalizeBusinessHours(businessHours);
  const slots = [];
  const start = timeToMinutes(normalized.start);
  const end = timeToMinutes(normalized.end);
  const serviceDuration = getSafeScheduleDuration(duration);

  for (let current = start; current + serviceDuration <= end; current += normalized.slotInterval) {
    slots.push(minutesToTime(current));
  }

  return slots;
};

export const isValidAppointmentTime = ({ date, time, duration = 30, businessHours, today = formatLocalDate() }) => {
  if (!date || !time) return false;
  if (date < today) return false;

  const normalized = normalizeBusinessHours(businessHours);
  const openMinutes = timeToMinutes(normalized.start);
  const closeMinutes = timeToMinutes(normalized.end);
  const startMinutes = timeToMinutes(time);
  const endMinutes = startMinutes + getSafeScheduleDuration(duration);

  return (
    startMinutes >= openMinutes &&
    endMinutes <= closeMinutes &&
    (startMinutes - openMinutes) % normalized.slotInterval === 0
  );
};

export const isFutureAppointmentStart = ({ date, time, now = new Date() }) => {
  if (!date || !time) return false;

  const today = formatLocalDate(now);
  if (date < today) return false;
  if (date > today) return true;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return timeToMinutes(time) > currentMinutes;
};

