import { normalizePhone } from "./phone.js";

export { normalizePhone } from "./phone.js";

export const CLIENT_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  phoneMin: 10,
  phoneMax: 13,
};

export const normalizeClientInput = ({ name = "", phone = "" } = {}) => ({
  name: String(name || "")
    .trim()
    .replace(/\s+/g, " "),
  phone: normalizePhone(phone),
});

export const validateClientInput = ({ name = "", phone = "" } = {}) => {
  const clientInput = normalizeClientInput({ name, phone });

  if (!clientInput.name || !clientInput.phone) {
    return "Preencha nome e telefone com DDD.";
  }

  if (clientInput.name.length < CLIENT_LIMITS.nameMin || clientInput.name.length > CLIENT_LIMITS.nameMax) {
    return `Nome do cliente deve ter entre ${CLIENT_LIMITS.nameMin} e ${CLIENT_LIMITS.nameMax} caracteres.`;
  }

  if (clientInput.phone.length < CLIENT_LIMITS.phoneMin || clientInput.phone.length > CLIENT_LIMITS.phoneMax) {
    return "Informe um telefone valido com DDD.";
  }

  return "";
};

export const createClientPhoneKeyId = ({ userId, phone }) =>
  `${userId}_${normalizePhone(phone)}`.replace(/[^a-zA-Z0-9_-]/g, "_");

export const createClientSnapshot = (client = {}) => {
  const snapshot = {
    id: String(client.id || ""),
    name: String(client.name || "").trim().replace(/\s+/g, " "),
    phone: normalizePhone(client.phoneNormalized || client.phone),
  };

  if (client.createdAt) snapshot.createdAt = client.createdAt;
  if (client.updatedAt) snapshot.updatedAt = client.updatedAt;
  if (client.userId) snapshot.userId = String(client.userId);
  if (client.barberSlug) snapshot.barberSlug = String(client.barberSlug);

  return snapshot;
};

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

export const upsertById = (items = [], nextItem = {}) => {
  const nextId = String(nextItem.id || "");
  if (!nextId) return [...items];

  let replaced = false;
  const nextItems = items.map((item) => {
    if (String(item.id || "") !== nextId) return item;
    replaced = true;
    return { ...item, ...nextItem };
  });

  return replaced ? nextItems : [...nextItems, nextItem];
};
