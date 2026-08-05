import { formatCurrencyBRL, formatDuration } from "./format.js";

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
  servicePrice: Number(service?.price || 0),
  serviceDuration: Number(service?.duration || 30),
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
    `${formatDuration(confirmation.serviceDuration || 30)} - ${formatCurrencyBRL(confirmation.servicePrice || 0)}`,
  ],
  ["Profissional", confirmation.barberName || "Barbeiro"],
  ["Data", confirmation.date || "Data nao informada"],
  ["Horario", confirmation.time || "Horario nao informado"],
];
