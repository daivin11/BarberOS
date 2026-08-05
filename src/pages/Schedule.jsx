import { Fragment, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppointmentCard from "../components/AppointmentCard";
import EmptyState from "../components/EmptyState";
import {
  APPOINTMENT_STATUS,
  countAppointmentsByStatus,
  getAppointmentStatus,
  isActiveAppointment,
} from "../utils/appointments";
import {
  createAppointmentDateWindow,
  getAppointmentWindowLabel,
  isDateWithinAppointmentWindow,
} from "../utils/appointmentWindow";
import { addLocalDays, formatLocalDate, parseLocalDate } from "../utils/date";
import { formatCurrencyBRL, formatDuration } from "../utils/format";
import {
  defaultBusinessHours,
  getTimeSlots,
  isTimeSlotAvailable,
  normalizeBusinessHours,
  overlaps,
  timeToMinutes,
} from "../utils/schedule";

const getDayLabel = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });

const getShortDayLabel = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

const addDays = (date, days) => {
  return addLocalDays(date, days);
};

const getWeekStart = (date) => {
  const value = parseLocalDate(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return formatLocalDate(value);
};

export default function Schedule({
  appointments,
  loading = false,
  clients,
  services,
  barbers = [],
  businessHours = defaultBusinessHours,
  appointmentWindow = createAppointmentDateWindow(),
  selectedClient,
  setSelectedClient,
  selectedService,
  setSelectedService,
  selectedBarber,
  setSelectedBarber,
  appointmentDate,
  setAppointmentDate,
  appointmentTime,
  setAppointmentTime,
  addAppointment,
  sendWhatsApp,
  updateAppointmentStatus,
  updateAppointment,
}) {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("active");
  const today = formatLocalDate();
  const [calendarDate, setCalendarDate] = useState(today);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [confirmingPendingId, setConfirmingPendingId] = useState("");
  const needsData = !loading && (clients.length === 0 || services.length === 0 || barbers.length === 0);
  const isSetupMode = searchParams.get("setup") === "first-booking";
  const appointmentWindowLabel = getAppointmentWindowLabel(appointmentWindow);
  const isCalendarAtStart = calendarDate <= appointmentWindow.startDate;
  const isCalendarAtEnd = calendarDate >= appointmentWindow.endDate;
  const normalizedBusinessHours = useMemo(() => normalizeBusinessHours(businessHours), [businessHours]);
  const activeAppointments = useMemo(
    () => appointments.filter(isActiveAppointment),
    [appointments]
  );
  const todayAppointments = useMemo(
    () => activeAppointments.filter((appointment) => appointment.date === today),
    [activeAppointments, today]
  );
  const selectedServiceData = useMemo(
    () => services.find((service) => String(service.id) === String(selectedService)),
    [services, selectedService]
  );
  const selectedServiceDuration = Number(selectedServiceData?.duration) || normalizedBusinessHours.slotInterval;
  const appointmentTimeOptions = useMemo(
    () =>
      selectedServiceData
        ? getTimeSlots({
            businessHours: normalizedBusinessHours,
            duration: selectedServiceDuration,
          })
        : [],
    [normalizedBusinessHours, selectedServiceData, selectedServiceDuration]
  );
  const selectedBarberBookedSlots = useMemo(
    () =>
      selectedBarber && appointmentDate
        ? activeAppointments.filter(
            (appointment) =>
              String(appointment.barberId) === String(selectedBarber) &&
              appointment.date === appointmentDate
          )
        : [],
    [activeAppointments, appointmentDate, selectedBarber]
  );
  const availableAppointmentTimeOptions = useMemo(
    () =>
      appointmentTimeOptions.filter((slot) =>
        isTimeSlotAvailable({
          time: slot,
          duration: selectedServiceDuration,
          bookedSlots: selectedBarberBookedSlots,
          interval: normalizedBusinessHours.slotInterval,
        })
      ),
    [appointmentTimeOptions, normalizedBusinessHours.slotInterval, selectedBarberBookedSlots, selectedServiceDuration]
  );
  const selectedClientData = useMemo(
    () => clients.find((client) => String(client.id) === String(selectedClient)),
    [clients, selectedClient]
  );
  const selectedBarberData = useMemo(
    () => barbers.find((barber) => String(barber.id) === String(selectedBarber)),
    [barbers, selectedBarber]
  );
  const canCreateAppointment =
    selectedClient &&
    selectedService &&
    selectedBarber &&
    appointmentDate &&
    appointmentTime &&
    availableAppointmentTimeOptions.includes(appointmentTime) &&
    isDateWithinAppointmentWindow(appointmentDate, appointmentWindow) &&
    !needsData;
  const assignedAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.barberId || appointment.barberName).length,
    [appointments]
  );
  const unassignedAppointments = appointments.length - assignedAppointments;
  const appointmentCounts = useMemo(() => countAppointmentsByStatus(appointments), [appointments]);
  const pendingAppointments = useMemo(
    () =>
      [...appointments]
        .filter((appointment) => getAppointmentStatus(appointment) === APPOINTMENT_STATUS.pending)
        .sort((first, second) => {
          const firstValue = `${first.date || ""} ${first.time || ""}`;
          const secondValue = `${second.date || ""} ${second.time || ""}`;
          return firstValue.localeCompare(secondValue);
        }),
    [appointments]
  );
  const nextPendingAppointment = pendingAppointments[0] || null;
  const pendingClientName = nextPendingAppointment?.client?.name || nextPendingAppointment?.clientName || "Cliente";
  const filterOptions = useMemo(
    () => [
      { value: "active", label: "Todos", count: activeAppointments.length },
      { value: APPOINTMENT_STATUS.pending, label: "Pendentes", count: appointmentCounts.pending },
      { value: APPOINTMENT_STATUS.confirmed, label: "Confirmados", count: appointmentCounts.confirmed },
      { value: APPOINTMENT_STATUS.completed, label: "Concluidos", count: appointmentCounts.completed },
      { value: APPOINTMENT_STATUS.cancelled, label: "Cancelados", count: appointmentCounts.cancelled },
    ],
    [activeAppointments.length, appointmentCounts]
  );
  const sortedAppointments = useMemo(() => {
    const visibleAppointments = appointments.filter((appointment) => {
      if (statusFilter === "active") return isActiveAppointment(appointment);
      return getAppointmentStatus(appointment) === statusFilter;
    });

    return [...visibleAppointments].sort((first, second) => {
      const firstValue = `${first.date || ""} ${first.time || ""}`;
      const secondValue = `${second.date || ""} ${second.time || ""}`;
      return firstValue.localeCompare(secondValue);
    });
  }, [appointments, statusFilter]);
  const calendarSlots = useMemo(() => {
    return getTimeSlots({ businessHours: normalizedBusinessHours, duration: normalizedBusinessHours.slotInterval });
  }, [normalizedBusinessHours]);
  const calendarAppointments = useMemo(
    () => activeAppointments.filter((appointment) => appointment.date === calendarDate),
    [activeAppointments, calendarDate]
  );
  const weekStart = useMemo(() => getWeekStart(calendarDate), [calendarDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const weeklySummary = useMemo(
    () =>
      weekDays.map((date) => {
        const dayAppointments = activeAppointments.filter((appointment) => appointment.date === date);
        return {
          date,
          total: dayAppointments.length,
          pending: dayAppointments.filter((appointment) => getAppointmentStatus(appointment) === APPOINTMENT_STATUS.pending).length,
          confirmed: dayAppointments.filter((appointment) => getAppointmentStatus(appointment) === APPOINTMENT_STATUS.confirmed).length,
        };
      }),
    [activeAppointments, weekDays]
  );
  const findAppointmentForCell = (barberId, slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + normalizedBusinessHours.slotInterval;

    return calendarAppointments.find((appointment) => {
      if (String(appointment.barberId) !== String(barberId)) return false;
      const appointmentStart = appointment.startMinutes ?? timeToMinutes(appointment.time);
      const appointmentEnd = appointment.endMinutes ?? appointmentStart + Number(appointment.duration || 30);
      return overlaps(slotStart, slotEnd, appointmentStart, appointmentEnd);
    });
  };
  const handleEmptySlotClick = (barberId, slot) => {
    if (!isDateWithinAppointmentWindow(calendarDate, appointmentWindow)) return;
    setSelectedBarber(barberId);
    setAppointmentDate(calendarDate);
    setAppointmentTime(slot);
  };
  const handleAddAppointment = async () => {
    if (!canCreateAppointment || creatingAppointment) return;

    setCreatingAppointment(true);
    try {
      await addAppointment?.();
    } finally {
      setCreatingAppointment(false);
    }
  };
  const handleConfirmPendingAppointment = async () => {
    if (!nextPendingAppointment || confirmingPendingId) return;

    setConfirmingPendingId(nextPendingAppointment.id);
    try {
      await updateAppointmentStatus?.(nextPendingAppointment.id, APPOINTMENT_STATUS.confirmed);
    } finally {
      setConfirmingPendingId("");
    }
  };
  const moveCalendarDate = (days) => {
    const nextDate = addDays(calendarDate, days);
    if (!isDateWithinAppointmentWindow(nextDate, appointmentWindow)) return;
    setCalendarDate(nextDate);
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 text-white sm:p-6 lg:p-8">
      <div className="mb-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Operacao diaria</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Agenda</h1>
            <p className="mt-2 max-w-2xl text-gray-400">
              Controle reservas ativas, encaixes internos e confirmacoes sem perder a visao do dia.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-500">{appointmentWindowLabel}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Hoje</p>
              <p className="mt-2 text-2xl font-black">{loading ? "..." : todayAppointments.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Ativos</p>
              <p className="mt-2 text-2xl font-black">{loading ? "..." : activeAppointments.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Equipe</p>
              <p className="mt-2 text-2xl font-black">{loading ? "..." : barbers.length}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <EmptyState
            eyebrow="Sincronizando"
            title="Carregando agenda..."
            description="Estamos buscando clientes, servicos, equipe e reservas antes de liberar os encaixes."
          />
        ) : needsData && (
          <EmptyState
            eyebrow="Agenda incompleta"
            title="Faltam dados para criar agendamentos"
            description="Cadastre pelo menos um cliente, um servico e um barbeiro antes de criar encaixes internos."
            actionLabel={
              clients.length === 0
                ? "Cadastrar cliente"
                : services.length === 0
                ? "Cadastrar servico"
                : "Cadastrar barbeiro"
            }
            actionTo={
              clients.length === 0
                ? "/clientes"
                : services.length === 0
                ? "/servicos"
                : "/barbeiros"
            }
            variant="warning"
          />
        )}
        {isSetupMode && !loading && !needsData && appointments.length === 0 && (
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">Etapa de ativacao</p>
            <h2 className="mt-2 text-xl font-bold">Crie um agendamento teste</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Selecione cliente, servico, barbeiro, data e horario para validar conflito de slots, status e lembrete por WhatsApp.
            </p>
          </div>
        )}
        {isSetupMode && !loading && appointments.length > 0 && (
          <div className="flex flex-col gap-3 rounded-3xl border border-emerald-600/40 bg-emerald-950/40 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-200">Fluxo validado</p>
              <p className="mt-1 text-sm text-gray-300">Agora revise o dashboard e compartilhe o link publico se ele estiver pronto.</p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              Voltar ao dashboard
            </Link>
          </div>
        )}
      </div>

      {!loading && (
      <>
      <section className="mb-6 rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-gray-500">Calendario diario</p>
            <h2 className="mt-2 text-2xl font-bold">{getDayLabel(calendarDate)}</h2>
            <p className="mt-2 text-sm text-gray-400">
              Clique em um horario livre para preencher o encaixe manual.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => moveCalendarDate(-1)}
              disabled={isCalendarAtStart}
              className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Dia anterior
            </button>
            <input
              type="date"
              value={calendarDate}
              min={appointmentWindow.startDate}
              max={appointmentWindow.endDate}
              onChange={(event) => setCalendarDate(event.target.value)}
              className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => moveCalendarDate(1)}
              disabled={isCalendarAtEnd}
              className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Proximo dia
            </button>
          </div>
        </div>

        <div className="mb-5 rounded-3xl border border-gray-800 bg-gray-950 p-3">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Semana</p>
              <p className="mt-1 text-sm text-gray-300">
                {getShortDayLabel(weekDays[0])} - {getShortDayLabel(weekDays[6])}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCalendarDate(addDays(weekStart, -7))}
                disabled={!isDateWithinAppointmentWindow(addDays(weekStart, -7), appointmentWindow)}
                className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Semana anterior
              </button>
              <button
                type="button"
                onClick={() => setCalendarDate(today)}
                disabled={!isDateWithinAppointmentWindow(today, appointmentWindow)}
                className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setCalendarDate(addDays(weekStart, 7))}
                disabled={!isDateWithinAppointmentWindow(addDays(weekStart, 7), appointmentWindow)}
                className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Proxima semana
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {weeklySummary.map((day) => {
              const selected = day.date === calendarDate;
              const isToday = day.date === today;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setCalendarDate(day.date)}
                  disabled={!isDateWithinAppointmentWindow(day.date, appointmentWindow)}
                  className={`min-h-[112px] rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-indigo-500 bg-indigo-500/15"
                      : "border-gray-800 bg-gray-900 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold capitalize text-white">
                        {getShortDayLabel(day.date)}
                      </p>
                      {isToday && (
                        <span className="mt-2 inline-flex rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                          Hoje
                        </span>
                      )}
                    </div>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white">
                      {day.total}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded-xl bg-yellow-500/10 px-2 py-2 text-yellow-200">
                      {day.pending} pend.
                    </span>
                    <span className="rounded-xl bg-indigo-500/10 px-2 py-2 text-indigo-200">
                      {day.confirmed} conf.
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {barbers.length === 0 ? (
          <EmptyState
            eyebrow="Sem equipe"
            title="Cadastre barbeiros para visualizar a agenda"
            description="Cada profissional vira uma coluna no calendario diario, facilitando encaixes e conflitos de horario."
            actionLabel="Cadastrar barbeiro"
            actionTo="/barbeiros"
          />
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[760px] gap-2"
              style={{ gridTemplateColumns: `88px repeat(${barbers.length}, minmax(180px, 1fr))` }}
            >
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-3 text-xs uppercase tracking-[0.2em] text-gray-500">
                Hora
              </div>
              {barbers.map((barber) => (
                <div key={barber.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-3">
                  <p className="truncate text-sm font-semibold text-white">{barber.name}</p>
                  <p className="truncate text-xs text-gray-500">{barber.specialty || "Profissional"}</p>
                </div>
              ))}

              {calendarSlots.map((slot) => (
                <Fragment key={slot}>
                  <div key={`${slot}-time`} className="rounded-2xl border border-gray-800 bg-gray-950 p-3 text-sm font-semibold text-gray-300">
                    {slot}
                  </div>
                  {barbers.map((barber) => {
                    const appointment = findAppointmentForCell(barber.id, slot);
                    return appointment ? (
                      <div
                        key={`${barber.id}-${slot}`}
                        className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-3"
                      >
                        <p className="truncate text-sm font-semibold text-white">
                          {appointment.time === slot ? appointment.client?.name || appointment.clientName || "Cliente" : "Ocupado"}
                        </p>
                        <p className="mt-1 truncate text-xs text-indigo-200">
                          {appointment.time === slot ? appointment.service?.name || "Servico" : `${appointment.time} - ${appointment.client?.name || appointment.clientName || "Cliente"}`}
                        </p>
                        <p className="mt-2 text-xs text-gray-400">{getAppointmentStatus(appointment)}</p>
                      </div>
                    ) : (
                      <button
                        key={`${barber.id}-${slot}`}
                        type="button"
                        onClick={() => handleEmptySlotClick(barber.id, slot)}
                        disabled={!isDateWithinAppointmentWindow(calendarDate, appointmentWindow)}
                        className="rounded-2xl border border-dashed border-gray-800 bg-gray-950 p-3 text-left text-xs text-gray-500 transition hover:border-indigo-500 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Livre
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.25em] text-gray-500">Novo encaixe</p>
            <h2 className="mt-2 text-2xl font-bold">Criar agendamento</h2>
            <p className="mt-2 text-sm text-gray-400">
              Use para reservas feitas por telefone, balcao ou WhatsApp.
            </p>
          </div>

          <div className="grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-300">Cliente</span>
              <select
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                <option value="">Selecione o cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-300">Servico</span>
              <select
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                value={selectedService}
                onChange={(e) => {
                  setSelectedService(e.target.value);
                  setAppointmentTime("");
                }}
              >
                <option value="">Selecione o servico</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {formatDuration(service.duration || 30)} - {formatCurrencyBRL(service.price)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-300">Barbeiro</span>
              <select
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                value={selectedBarber}
                onChange={(e) => {
                  setSelectedBarber(e.target.value);
                  setAppointmentTime("");
                }}
              >
                <option value="">Selecione o barbeiro</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-300">Data</span>
                <input
                  className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                  type="date"
                  min={today > appointmentWindow.startDate ? today : appointmentWindow.startDate}
                  max={appointmentWindow.endDate}
                  value={appointmentDate}
                  onChange={(e) => {
                    setAppointmentDate(e.target.value);
                    setAppointmentTime("");
                  }}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-300">Horario</span>
                <select
                  className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                  value={appointmentTime}
                  disabled={!selectedServiceData || !selectedBarber || !appointmentDate || availableAppointmentTimeOptions.length === 0}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                >
                  <option value="">
                    {!selectedServiceData
                      ? "Escolha um servico primeiro"
                      : !selectedBarber
                      ? "Escolha um barbeiro primeiro"
                      : !appointmentDate
                      ? "Escolha uma data primeiro"
                      : availableAppointmentTimeOptions.length === 0
                      ? "Sem horarios disponiveis"
                      : "Selecione o horario"}
                  </option>
                  {availableAppointmentTimeOptions.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
              <p className="font-semibold text-white">Resumo</p>
              <p className="mt-2">{selectedClientData?.name || "Cliente nao selecionado"}</p>
              <p>
                {selectedServiceData
                  ? `${selectedServiceData.name} - ${formatDuration(selectedServiceData.duration || 30)}`
                  : "Servico nao selecionado"}
              </p>
              <p>{selectedBarberData?.name || "Barbeiro nao selecionado"}</p>
            </div>

            <button type="button"
              className={`mt-2 w-full rounded-2xl py-4 font-semibold transition ${
                canCreateAppointment && !creatingAppointment
                  ? "bg-white text-black hover:bg-gray-200"
                  : "cursor-not-allowed bg-gray-700 text-gray-400"
              }`}
              onClick={handleAddAppointment}
              disabled={!canCreateAppointment || creatingAppointment}
            >
              {creatingAppointment ? "Criando agendamento..." : "Criar agendamento"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Fila de agendamentos</h2>
              <p className="text-gray-400">
                Por padrao, o painel mostra apenas horarios pendentes e confirmados.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-white/5 px-3 py-2 text-gray-300">
                {activeAppointments.length} ativos
              </span>
              <span className="rounded-full bg-white/5 px-3 py-2 text-gray-400">
                {appointments.length} total
              </span>
              {unassignedAppointments > 0 && (
                <span className="rounded-full border border-yellow-700 bg-yellow-900/30 px-3 py-2 text-yellow-300">
                  {unassignedAppointments} sem barbeiro
                </span>
              )}
            </div>
          </div>

          {nextPendingAppointment && (
            <div className="mb-5 rounded-3xl border border-yellow-600/50 bg-yellow-950/40 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-yellow-300">Resposta pendente</p>
                  <h3 className="mt-2 text-xl font-bold text-white">
                    Confirme o pedido de {pendingClientName}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-yellow-100/80">
                    {nextPendingAppointment.service?.name || "Servico"} em {nextPendingAppointment.date} as {nextPendingAppointment.time}. Clientes esperam retorno rapido depois de solicitar pelo link publico.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleConfirmPendingAppointment}
                    disabled={confirmingPendingId === nextPendingAppointment.id}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {confirmingPendingId === nextPendingAppointment.id ? "Confirmando..." : "Confirmar agora"}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendWhatsApp(nextPendingAppointment)}
                    className="rounded-2xl border border-emerald-600 bg-emerald-950/60 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400"
                  >
                    Chamar no WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-5 flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const selected = statusFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    selected
                      ? "bg-white text-black"
                      : "border border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  {option.label} ({option.count})
                </button>
              );
            })}
          </div>

          {appointments.length === 0 ? (
            <EmptyState
              eyebrow="Agenda vazia"
              title="Sua agenda ainda esta vazia"
              description="Compartilhe o link publico ou crie um encaixe manual para testar o fluxo completo de cliente, servico, barbeiro e status."
            />
          ) : sortedAppointments.length === 0 ? (
            <EmptyState
              eyebrow="Filtro"
              title="Nada neste filtro"
              description="Troque o status para revisar outros agendamentos."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {sortedAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  clients={clients}
                  services={services}
                  barbers={barbers}
                  sendWhatsApp={sendWhatsApp}
                  onStatusChange={updateAppointmentStatus}
                  onUpdateAppointment={updateAppointment}
                  appointmentWindow={appointmentWindow}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      </>
      )}
    </main>
  );
}
