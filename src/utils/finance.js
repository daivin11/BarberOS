import {
  APPOINTMENT_STATUS,
  getAppointmentStatus,
  isActiveAppointment,
  isCancelledAppointment,
  isCompletedAppointment,
} from "./appointments.js";

export const getServicePrice = (appointment) =>
  Number(appointment?.service?.price ?? appointment?.servicePrice ?? 0);

export const calculateFinanceMetrics = (appointments = []) => {
  const completedAppointments = appointments.filter(isCompletedAppointment);
  const cancelledAppointments = appointments.filter(isCancelledAppointment);
  const activeAppointments = appointments.filter(isActiveAppointment);
  const pendingAppointments = appointments.filter(
    (appointment) => getAppointmentStatus(appointment) === APPOINTMENT_STATUS.pending
  );
  const confirmedAppointments = appointments.filter(
    (appointment) => getAppointmentStatus(appointment) === APPOINTMENT_STATUS.confirmed
  );

  const realizedRevenue = completedAppointments.reduce(
    (total, appointment) => total + getServicePrice(appointment),
    0
  );
  const projectedRevenue = activeAppointments.reduce(
    (total, appointment) => total + getServicePrice(appointment),
    0
  );
  const pendingRevenue = pendingAppointments.reduce(
    (total, appointment) => total + getServicePrice(appointment),
    0
  );
  const confirmedRevenue = confirmedAppointments.reduce(
    (total, appointment) => total + getServicePrice(appointment),
    0
  );
  const lostRevenue = cancelledAppointments.reduce(
    (total, appointment) => total + getServicePrice(appointment),
    0
  );
  const decisionableAppointments =
    completedAppointments.length + cancelledAppointments.length + activeAppointments.length;

  return {
    activeAppointments,
    cancelledAppointments,
    completedAppointments,
    confirmedAppointments,
    pendingAppointments,
    realizedRevenue,
    projectedRevenue,
    pendingRevenue,
    confirmedRevenue,
    lostRevenue,
    averageTicket: completedAppointments.length
      ? realizedRevenue / completedAppointments.length
      : 0,
    completionRate: decisionableAppointments
      ? completedAppointments.length / decisionableAppointments
      : 0,
    cancellationRate: decisionableAppointments
      ? cancelledAppointments.length / decisionableAppointments
      : 0,
    pendingShare: activeAppointments.length
      ? pendingAppointments.length / activeAppointments.length
      : 0,
  };
};

export const getUpcomingRevenueAppointments = (appointments = [], limit = 5) =>
  appointments
    .filter(isActiveAppointment)
    .sort((first, second) => {
      const firstValue = `${first.date || ""} ${first.time || ""}`;
      const secondValue = `${second.date || ""} ${second.time || ""}`;
      return firstValue.localeCompare(secondValue);
    })
    .slice(0, limit);

export const formatPercentage = (value) =>
  `${Math.round(Number(value || 0) * 100)}%`;
