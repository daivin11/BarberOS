import { formatCurrencyBRL, formatDuration } from "./format.js";
import { getServiceCatalogDuration, getServiceCatalogPrice } from "./services.js";

export const createBookingConfirmation = ({
  clientName,
  clientPhone,
  service,
  barber,
  date,
  time,
  createdAt = new Date(),
} = {}) => ({
  clientName: String(clientName || "").trim(),
  clientPhone: String(clientPhone || "").trim(),
  serviceName: service?.name || "Servico",
  servicePrice: getServiceCatalogPrice(service),
  serviceDuration: getServiceCatalogDuration(service),
  barberName: barber?.name || "Barbeiro",
  date: String(date || ""),
  time: String(time || ""),
  createdAt,
  status: "pending",
});

export const getBookingConfirmationLines = (confirmation = {}) => [
  ["Cliente", confirmation.clientName || "Nao informado"],
  ["Servico", confirmation.serviceName || "Servico"],
  [
    "Duracao e valor",
    `${formatDuration(getServiceCatalogDuration({ duration: confirmation.serviceDuration }))} - ${formatCurrencyBRL(getServiceCatalogPrice({ price: confirmation.servicePrice }))}`,
  ],
  ["Profissional", confirmation.barberName || "Barbeiro"],
  ["Data", confirmation.date || "Data nao informada"],
  ["Horario", confirmation.time || "Horario nao informado"],
];
