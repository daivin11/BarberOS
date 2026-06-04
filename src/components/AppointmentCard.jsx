import { useState } from "react";

export default function AppointmentCard({
  appointment,
  barbers = [],
  sendWhatsApp,
  onStatusChange,
}) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-900/40 text-yellow-300 border border-yellow-700";
      case "confirmed":
        return "bg-blue-900/40 text-blue-300 border border-blue-700";
      case "completed":
        return "bg-emerald-900/40 text-emerald-300 border border-emerald-700";
      case "cancelled":
        return "bg-red-900/40 text-red-300 border border-red-700";
      default:
        return "bg-gray-800 text-gray-300 border border-gray-700";
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluido",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const currentStatus = appointment.status || "pending";
  const clientName = appointment.client?.name || appointment.clientName || "Cliente";
  const serviceName = appointment.service?.name || appointment.serviceName || "Servico";
  const servicePrice = appointment.service?.price ?? appointment.servicePrice;
  const matchedBarber = barbers.find((barber) => barber.id === appointment.barberId);
  const barberName = appointment.barberName || matchedBarber?.name || "Barbeiro nao definido";
  const appointmentDate = appointment.date || "Data nao definida";
  const appointmentTime = appointment.time || "Horario nao definido";
  const isCancelled = currentStatus === "cancelled";

  const handleCancelAppointment = async () => {
    if (!onStatusChange) return;

    setCancelLoading(true);
    try {
      await onStatusChange(appointment.id, "cancelled");
      setShowCancelModal(false);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <>
      <article className="rounded-3xl border border-gray-800 bg-gray-950 p-5 shadow-sm transition hover:border-gray-700">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Cliente</p>
                <h3 className="mt-2 break-words text-xl font-semibold text-white">{clientName}</h3>
              </div>

              <span
                className={`w-fit rounded-2xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${getStatusColor(
                  currentStatus
                )}`}
              >
                {getStatusLabel(currentStatus)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Servico</p>
                <p className="mt-2 font-semibold text-white">{serviceName}</p>
                {servicePrice !== undefined && servicePrice !== null && (
                  <p className="mt-1 text-sm text-gray-400">R$ {Number(servicePrice).toFixed(2)}</p>
                )}
              </div>

              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Barbeiro</p>
                <p className="mt-2 font-semibold text-white">{barberName}</p>
                {appointment.barberId && (
                  <p className="mt-1 truncate text-xs text-indigo-200/70">ID {appointment.barberId}</p>
                )}
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Data e hora</p>
                <p className="mt-2 font-semibold text-white">{appointmentDate}</p>
                <p className="mt-1 text-sm text-gray-400">{appointmentTime}</p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            {onStatusChange && (
              <select
                value={currentStatus}
                onChange={(e) => onStatusChange(appointment.id, e.target.value)}
                className="rounded-2xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs outline-none transition focus:border-indigo-500"
              >
                <option value="pending">Pendente</option>
                <option value="confirmed">Confirmado</option>
                <option value="completed">Concluido</option>
                <option value="cancelled">Cancelado</option>
              </select>
            )}

            <button
              className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
              onClick={() => sendWhatsApp(appointment)}
            >
              WhatsApp
            </button>

            {onStatusChange && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={isCancelled}
                className="rounded-2xl border border-red-700 bg-red-950/70 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-900/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </article>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900 p-6 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-red-300">Cancelar agendamento</p>
            <h2 className="mt-4 text-2xl font-bold">Tem certeza que deseja cancelar este agendamento?</h2>
            <p className="mt-3 text-sm text-gray-400">
              O status sera atualizado para cancelado e este horario deixara de contar como ativo.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:border-white/40"
              >
                Manter agendamento
              </button>
              <button
                type="button"
                onClick={handleCancelAppointment}
                disabled={cancelLoading}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelLoading ? "Cancelando..." : "Cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
