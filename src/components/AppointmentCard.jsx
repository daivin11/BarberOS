import { useMemo, useState } from "react";
import {
  APPOINTMENT_STATUS,
  getAppointmentBarberId,
  getAppointmentClientId,
  getAppointmentServiceId,
  getAppointmentStatus,
  getAppointmentStatusClass,
  getAppointmentStatusLabel,
  isActiveAppointment,
  isTerminalAppointment,
} from "../utils/appointments";
import { createAppointmentDateWindow, isDateWithinAppointmentWindow } from "../utils/appointmentWindow";
import { formatCurrencyBRL, formatDuration } from "../utils/format";
import { getServiceCatalogDuration } from "../utils/services";
import { getServicePrice } from "../utils/finance";
import {
  defaultBusinessHours,
  getTimeSlots,
  isTimeSlotAvailable,
  normalizeBusinessHours,
} from "../utils/schedule";

export default function AppointmentCard({
  appointment,
  clients = [],
  services = [],
  barbers = [],
  appointments = [],
  businessHours = defaultBusinessHours,
  sendWhatsApp,
  onStatusChange,
  onUpdateAppointment,
  appointmentWindow = createAppointmentDateWindow(),
}) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editClientId, setEditClientId] = useState(getAppointmentClientId(appointment));
  const [editServiceId, setEditServiceId] = useState(getAppointmentServiceId(appointment));
  const [editBarberId, setEditBarberId] = useState(getAppointmentBarberId(appointment));
  const [editDate, setEditDate] = useState(appointment.date || "");
  const [editTime, setEditTime] = useState(appointment.time || "");

  const currentStatus = getAppointmentStatus(appointment);
  const clientName = appointment.client?.name || appointment.clientName || "Cliente";
  const serviceName = appointment.service?.name || appointment.serviceName || "Servico";
  const servicePrice = getServicePrice(appointment);
  const matchedBarber = barbers.find((barber) => String(barber.id) === String(getAppointmentBarberId(appointment)));
  const barberName = appointment.barberName || matchedBarber?.name || "Barbeiro nao definido";
  const appointmentDate = appointment.date || "Data nao definida";
  const appointmentTime = appointment.time || "Horario nao definido";
  const isTerminal = isTerminalAppointment(appointment);
  const isPending = currentStatus === APPOINTMENT_STATUS.pending;
  const normalizedBusinessHours = useMemo(() => normalizeBusinessHours(businessHours), [businessHours]);
  const editServiceData = useMemo(
    () => services.find((service) => String(service.id) === String(editServiceId)),
    [editServiceId, services]
  );
  const editServiceDuration = getServiceCatalogDuration(editServiceData, normalizedBusinessHours.slotInterval);
  const editBookedSlots = useMemo(
    () =>
      editBarberId && editDate
        ? appointments.filter(
            (item) =>
              String(item.id) !== String(appointment.id) &&
              String(item.barberId) === String(editBarberId) &&
              item.date === editDate &&
              isActiveAppointment(item)
          )
        : [],
    [appointment.id, appointments, editBarberId, editDate]
  );
  const editTimeOptions = useMemo(
    () =>
      editServiceData
        ? getTimeSlots({
            businessHours: normalizedBusinessHours,
            duration: editServiceDuration,
          }).filter((slot) =>
            isTimeSlotAvailable({
              time: slot,
              duration: editServiceDuration,
              bookedSlots: editBookedSlots,
              interval: normalizedBusinessHours.slotInterval,
            })
          )
        : [],
    [editBookedSlots, editServiceData, editServiceDuration, normalizedBusinessHours]
  );
  const canEdit = Boolean(onUpdateAppointment) && !isTerminal;
  const canSaveEdit =
    editClientId &&
    editServiceId &&
    editBarberId &&
    editDate &&
    editTime &&
    editTimeOptions.includes(editTime) &&
    isDateWithinAppointmentWindow(editDate, appointmentWindow);

  const resetEditForm = () => {
    setEditClientId(getAppointmentClientId(appointment));
    setEditServiceId(getAppointmentServiceId(appointment));
    setEditBarberId(getAppointmentBarberId(appointment));
    setEditDate(appointment.date || "");
    setEditTime(appointment.time || "");
  };

  const handleCancelAppointment = async () => {
    if (!onStatusChange || cancelLoading) return;

    setCancelLoading(true);
    try {
      await onStatusChange(appointment.id, APPOINTMENT_STATUS.cancelled);
      setShowCancelModal(false);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleStatusChange = async (nextStatus) => {
    if (!onStatusChange || statusLoading || isTerminal || nextStatus === currentStatus) return;

    setStatusLoading(true);
    try {
      await onStatusChange(appointment.id, nextStatus);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!onUpdateAppointment || !canSaveEdit || editLoading) return;

    setEditLoading(true);
    try {
      const success = await onUpdateAppointment(appointment.id, {
        clientId: editClientId,
        serviceId: editServiceId,
        barberId: editBarberId,
        date: editDate,
        time: editTime,
      });
      if (success) setShowEditModal(false);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <>
      <article className="rounded-3xl border border-gray-800 bg-gray-950 p-4 shadow-sm transition hover:border-gray-700 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Cliente</p>
                <h3 className="mt-2 break-words text-xl font-semibold text-white">{clientName}</h3>
              </div>

              <span
                className={`w-fit rounded-2xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${getAppointmentStatusClass(
                  currentStatus
                )}`}
              >
                {getAppointmentStatusLabel(currentStatus)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Servico</p>
                <p className="mt-2 font-semibold text-white">{serviceName}</p>
                {servicePrice > 0 && (
                  <p className="mt-1 text-sm text-gray-400">{formatCurrencyBRL(servicePrice)}</p>
                )}
              </div>

              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Barbeiro</p>
                <p className="mt-2 font-semibold text-white">{barberName}</p>
                <p className="mt-1 text-sm text-indigo-200/70">Profissional responsavel</p>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Data e hora</p>
                <p className="mt-2 font-semibold text-white">{appointmentDate}</p>
                <p className="mt-1 text-sm text-gray-400">{appointmentTime}</p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            {onStatusChange && isPending && (
              <button
                type="button"
                onClick={() => handleStatusChange(APPOINTMENT_STATUS.confirmed)}
                disabled={statusLoading}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {statusLoading ? "Confirmando..." : "Confirmar"}
              </button>
            )}

            {onStatusChange && (
              <select
                value={currentStatus}
                onChange={(event) => handleStatusChange(event.target.value)}
                disabled={isTerminal || statusLoading}
                className="w-full rounded-2xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs outline-none transition focus:border-indigo-500 sm:w-auto lg:w-full"
              >
                <option value={APPOINTMENT_STATUS.pending}>Pendente</option>
                <option value={APPOINTMENT_STATUS.confirmed}>Confirmado</option>
                <option value={APPOINTMENT_STATUS.completed}>Concluido</option>
                <option value={APPOINTMENT_STATUS.cancelled}>Cancelado</option>
              </select>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  resetEditForm();
                  setShowEditModal(true);
                }}
                className="rounded-2xl border border-indigo-500 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/15"
              >
                Editar
              </button>
            )}

            <button
              type="button"
              className={`rounded-2xl px-4 py-2 text-sm font-semibold text-white transition ${
                isPending ? "bg-emerald-600 hover:bg-emerald-700" : "bg-green-600 hover:bg-green-700"
              }`}
              onClick={() => sendWhatsApp(appointment)}
            >
              {isPending ? "Confirmar no WhatsApp" : "WhatsApp"}
            </button>

            {onStatusChange && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={isTerminal || statusLoading}
                className="rounded-2xl border border-red-700 bg-red-950/70 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-900/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </article>

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-2xl rounded-3xl border border-gray-800 bg-gray-900 p-6 text-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-appointment-${appointment.id}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Editar agendamento</p>
                <h2 id={`edit-appointment-${appointment.id}`} className="mt-4 text-2xl font-bold">Atualizar reserva</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Ao salvar, o BarberOS recalcula os slots para evitar conflito de horario.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                aria-label="Fechar edicao do agendamento"
                className="rounded-full border border-gray-700 bg-gray-950 px-3 py-2 text-gray-300 hover:border-white/20"
              >
                X
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm text-gray-300">Cliente</span>
                <select
                  value={editClientId}
                  onChange={(event) => setEditClientId(event.target.value)}
                  className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
                >
                  <option value="">Selecione</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm text-gray-300">Servico</span>
                <select
                  value={editServiceId}
                  onChange={(event) => {
                    setEditServiceId(event.target.value);
                    setEditTime("");
                  }}
                  className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
                >
                  <option value="">Selecione</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {formatDuration(getServiceCatalogDuration(service))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm text-gray-300">Barbeiro</span>
                <select
                  value={editBarberId}
                  onChange={(event) => {
                    setEditBarberId(event.target.value);
                    setEditTime("");
                  }}
                  className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
                >
                  <option value="">Selecione</option>
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm text-gray-300">Data</span>
                  <input
                    type="date"
                    min={appointmentWindow.startDate}
                    max={appointmentWindow.endDate}
                    value={editDate}
                    onChange={(event) => {
                      setEditDate(event.target.value);
                      setEditTime("");
                    }}
                    className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm text-gray-300">Horario</span>
                  <select
                    value={editTime}
                    disabled={!editServiceData || !editBarberId || !editDate || editTimeOptions.length === 0}
                    onChange={(event) => setEditTime(event.target.value)}
                    className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
                  >
                    <option value="">
                      {!editServiceData
                        ? "Escolha um servico"
                        : !editBarberId
                        ? "Escolha um barbeiro"
                        : !editDate
                        ? "Escolha uma data"
                        : editTimeOptions.length === 0
                        ? "Sem horarios disponiveis"
                        : "Selecione o horario"}
                    </option>
                    {editTimeOptions.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:border-white/40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!canSaveEdit || editLoading}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editLoading ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900 p-6 text-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`cancel-appointment-${appointment.id}`}
          >
            <p className="text-sm uppercase tracking-[0.3em] text-red-300">Cancelar agendamento</p>
            <h2 id={`cancel-appointment-${appointment.id}`} className="mt-4 text-2xl font-bold">Tem certeza que deseja cancelar este agendamento?</h2>
            <p className="mt-3 text-sm text-gray-400">
O status sera atualizado para cancelado, este horario sera liberado e a reserva nao podera ser reativada pelo painel.
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
