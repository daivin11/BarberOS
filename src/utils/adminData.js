import { normalizePhone } from "./phone.js";

export { normalizePhone } from "./phone.js";

export const createClientPhoneKeyId = ({ userId, phone }) =>
  `${userId}_${normalizePhone(phone)}`.replace(/[^a-zA-Z0-9_-]/g, "_");

export const getDateValue = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();

  const parsedValue = new Date(value).getTime();
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

export const sortByCreatedAtDesc = (items) =>
  [...items].sort((first, second) => getDateValue(second.createdAt) - getDateValue(first.createdAt));

export const sortByName = (items) =>
  [...items].sort((first, second) => String(first.name || "").localeCompare(String(second.name || ""), "pt-BR"));

export const sortAppointments = (items) =>
  [...items].sort((first, second) => {
    const firstValue = `${first.date || ""} ${first.time || ""}`;
    const secondValue = `${second.date || ""} ${second.time || ""}`;
    return firstValue.localeCompare(secondValue);
  });
