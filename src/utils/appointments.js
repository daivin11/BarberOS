export const APPOINTMENT_STATUS = {
  pending: "pending",
  confirmed: "confirmed",
  completed: "completed",
  cancelled: "cancelled",
};

export const ACTIVE_APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS.pending,
  APPOINTMENT_STATUS.confirmed,
];

export const TERMINAL_APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS.completed,
  APPOINTMENT_STATUS.cancelled,
];

export const APPOINTMENT_STATUS_LABELS = {
  [APPOINTMENT_STATUS.pending]: "Pendente",
  [APPOINTMENT_STATUS.confirmed]: "Confirmado",
  [APPOINTMENT_STATUS.completed]: "Concluido",
  [APPOINTMENT_STATUS.cancelled]: "Cancelado",
};

export const getAppointmentStatus = (appointment) =>
  appointment?.status || APPOINTMENT_STATUS.pending;

export const isActiveAppointment = (appointment) =>
  ACTIVE_APPOINTMENT_STATUSES.includes(getAppointmentStatus(appointment));

export const isCancelledAppointment = (appointment) =>
  getAppointmentStatus(appointment) === APPOINTMENT_STATUS.cancelled;

export const isCompletedAppointment = (appointment) =>
  getAppointmentStatus(appointment) === APPOINTMENT_STATUS.completed;

export const isTerminalAppointment = (appointment) =>
  TERMINAL_APPOINTMENT_STATUSES.includes(getAppointmentStatus(appointment));

export const getAppointmentStatusLabel = (status) =>
  APPOINTMENT_STATUS_LABELS[status] || status || APPOINTMENT_STATUS_LABELS[APPOINTMENT_STATUS.pending];

export const getAppointmentStatusClass = (status) => {
  switch (status) {
    case APPOINTMENT_STATUS.pending:
      return "bg-yellow-900/40 text-yellow-300 border border-yellow-700";
    case APPOINTMENT_STATUS.confirmed:
      return "bg-blue-900/40 text-blue-300 border border-blue-700";
    case APPOINTMENT_STATUS.completed:
      return "bg-emerald-900/40 text-emerald-300 border border-emerald-700";
    case APPOINTMENT_STATUS.cancelled:
      return "bg-red-900/40 text-red-300 border border-red-700";
    default:
      return "bg-gray-800 text-gray-300 border border-gray-700";
  }
};

export const countAppointmentsByStatus = (appointments = []) =>
  appointments.reduce(
    (counts, appointment) => {
      const status = getAppointmentStatus(appointment);
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    {
      [APPOINTMENT_STATUS.pending]: 0,
      [APPOINTMENT_STATUS.confirmed]: 0,
      [APPOINTMENT_STATUS.completed]: 0,
      [APPOINTMENT_STATUS.cancelled]: 0,
    }
  );

export const countActiveAppointmentsByField = (appointments = [], fieldName) =>
  appointments.reduce((counts, appointment) => {
    const value = appointment?.[fieldName];
    if (!value || !isActiveAppointment(appointment)) return counts;

    const key = String(value);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
