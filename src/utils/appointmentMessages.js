import { APPOINTMENT_STATUS, getAppointmentStatus } from "./appointments.js";

export const getAppointmentClientName = (appointment = {}) =>
  appointment.client?.name || appointment.clientName || "cliente";

export const createAppointmentWhatsAppMessage = (appointment = {}) => {
  const clientName = getAppointmentClientName(appointment);
  const serviceName = appointment.service?.name || appointment.serviceName || "servico";
  const date = appointment.date || "data combinada";
  const time = appointment.time || "horario combinado";

  if (getAppointmentStatus(appointment) === APPOINTMENT_STATUS.pending) {
    return `Ola, ${clientName}! Recebemos sua solicitacao de ${serviceName} para ${date} as ${time}. Podemos confirmar esse horario?`;
  }

  if (getAppointmentStatus(appointment) === APPOINTMENT_STATUS.confirmed) {
    return `Ola, ${clientName}! Seu horario de ${serviceName} esta confirmado para ${date} as ${time}. Qualquer ajuste, fale com a gente.`;
  }

  return `Ola, ${clientName}! Passando sobre seu horario de ${serviceName} no dia ${date} as ${time}.`;
};
