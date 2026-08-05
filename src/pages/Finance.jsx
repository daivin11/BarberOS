import { useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import {
  APPOINTMENT_STATUS,
  getAppointmentStatus,
  getAppointmentStatusClass,
  getAppointmentStatusLabel,
  isActiveAppointment,
} from "../utils/appointments";
import {
  createAppointmentDateWindow,
  getAppointmentWindowLabel,
  getAppointmentWindowMonthBounds,
  isMonthWithinAppointmentWindow,
} from "../utils/appointmentWindow";
import { formatLocalDate } from "../utils/date";
import { formatCurrencyBRL } from "../utils/format";
import {
  calculateFinanceMetrics,
  formatPercentage,
  getServicePrice,
  getUpcomingRevenueAppointments,
} from "../utils/finance";

export default function Finance({ appointments = [], loading = false, appointmentWindow = createAppointmentDateWindow() }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(formatLocalDate().slice(0, 7));
  const { startMonth, endMonth } = useMemo(
    () => getAppointmentWindowMonthBounds(appointmentWindow),
    [appointmentWindow]
  );
  const selectedMonthIsLoaded = isMonthWithinAppointmentWindow(selectedMonth, appointmentWindow);
  const appointmentWindowLabel = getAppointmentWindowLabel(appointmentWindow);

  const monthAppointments = useMemo(() => {
    if (!selectedMonthIsLoaded) return [];
    if (!selectedMonth) return appointments;
    return appointments.filter((appointment) => String(appointment.date || "").startsWith(selectedMonth));
  }, [appointments, selectedMonth, selectedMonthIsLoaded]);

  const metrics = useMemo(() => {
    return calculateFinanceMetrics(monthAppointments);
  }, [monthAppointments]);

  const upcomingRevenueAppointments = useMemo(
    () => getUpcomingRevenueAppointments(monthAppointments, 5),
    [monthAppointments]
  );

  const filteredAppointments = useMemo(() => {
    const sorted = [...monthAppointments].sort((first, second) => {
      const firstValue = `${first.date || ""} ${first.time || ""}`;
      const secondValue = `${second.date || ""} ${second.time || ""}`;
      return secondValue.localeCompare(firstValue);
    });

    if (statusFilter === "all") return sorted;
    if (statusFilter === "active") {
      return sorted.filter(isActiveAppointment);
    }
    return sorted.filter((appointment) => getAppointmentStatus(appointment) === statusFilter);
  }, [monthAppointments, statusFilter]);

  const filters = [
    { value: "all", label: "Todos", count: monthAppointments.length },
    { value: "active", label: "Ativos", count: metrics.activeAppointments.length },
    { value: APPOINTMENT_STATUS.completed, label: "Concluidos", count: metrics.completedAppointments.length },
    { value: APPOINTMENT_STATUS.cancelled, label: "Cancelados", count: metrics.cancelledAppointments.length },
  ];

  return (
    <main className="flex-1 overflow-y-auto p-4 text-white sm:p-6 lg:p-8">
      <div className="mb-8 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Receita</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Financeiro</h1>
            <p className="mt-2 max-w-2xl text-gray-400">
              Separe dinheiro realizado, previsao de agenda e perdas por cancelamento.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-500">{appointmentWindowLabel}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
              <span className="block text-xs uppercase tracking-[0.25em] text-gray-500">Mes</span>
              <input
                type="month"
                min={startMonth}
                max={endMonth}
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="mt-2 w-full bg-transparent text-sm font-semibold text-white outline-none"
              />
            </label>
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Ticket medio</p>
              <p className="mt-2 text-2xl font-black">{loading ? "..." : formatCurrencyBRL(metrics.averageTicket)}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        {[
          ["Receita realizada", metrics.realizedRevenue, "Somente atendimentos concluidos."],
          ["Receita prevista", metrics.projectedRevenue, "Pendentes e confirmados."],
          ["Perdas canceladas", metrics.lostRevenue, "Valor de agendamentos cancelados."],
        ].map(([label, value, helper]) => (
          <div key={label} className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
            <p className="text-sm font-medium text-gray-400">{label}</p>
            <p className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              {loading ? "..." : formatCurrencyBRL(value)}
            </p>
            <p className="mt-3 text-sm text-gray-500">{helper}</p>
          </div>
        ))}
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Saude do mes</p>
              <h2 className="mt-2 text-2xl font-bold">Conversao financeira</h2>
              <p className="mt-2 text-sm text-gray-400">
                Use estes sinais para decidir se precisa confirmar pedidos, reduzir cancelamentos ou fechar atendimentos.
              </p>
            </div>
            <span className="w-fit rounded-full bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-gray-400">
              {monthAppointments.length} movimentos
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Conclusao", formatPercentage(metrics.completionRate), "Atendimentos que viraram receita."],
              ["Cancelamento", formatPercentage(metrics.cancellationRate), "Receita que saiu do caixa."],
              ["Pendencia", formatPercentage(metrics.pendingShare), "Agenda ativa ainda sem confirmacao."],
            ].map(([label, value, helper]) => (
              <div key={label} className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{label}</p>
                <p className="mt-3 text-3xl font-black">{loading ? "..." : value}</p>
                <p className="mt-2 text-sm leading-5 text-gray-400">{helper}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-yellow-700/60 bg-yellow-950/30 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-yellow-300">Receita pendente</p>
              <p className="mt-3 text-2xl font-black">{loading ? "..." : formatCurrencyBRL(metrics.pendingRevenue)}</p>
              <p className="mt-2 text-sm text-yellow-100/75">
                {metrics.pendingAppointments.length} pedidos precisam de retorno antes de entrar como previsao firme.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-700/60 bg-blue-950/30 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-blue-300">Receita confirmada</p>
              <p className="mt-3 text-2xl font-black">{loading ? "..." : formatCurrencyBRL(metrics.confirmedRevenue)}</p>
              <p className="mt-2 text-sm text-blue-100/75">
                {metrics.confirmedAppointments.length} horarios ativos ja estao confirmados no mes.
              </p>
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Proximos recebimentos</p>
          <h2 className="mt-2 text-2xl font-bold">Agenda que vira caixa</h2>
          <p className="mt-2 text-sm text-gray-400">
            Priorize confirmacao dos proximos horarios para proteger a previsao.
          </p>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
                Carregando proximos recebimentos...
              </div>
            ) : upcomingRevenueAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
                Nenhum horario ativo neste mes.
              </div>
            ) : (
              upcomingRevenueAppointments.map((appointment) => {
                const status = getAppointmentStatus(appointment);
                return (
                  <article key={appointment.id || `${appointment.date}-${appointment.time}`} className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {appointment.client?.name || appointment.clientName || "Cliente"}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          {appointment.date || "Data"} as {appointment.time || "Horario"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-white">
                        {formatCurrencyBRL(getServicePrice(appointment))}
                      </p>
                    </div>
                    <span className={`mt-3 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getAppointmentStatusClass(status)}`}>
                      {getAppointmentStatusLabel(status)}
                    </span>
                  </article>
                );
              })
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Movimentacao por agendamento</h2>
            <p className="mt-2 text-gray-400">Audite quais reservas impactam receita, previsao e perda.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  statusFilter === filter.value
                    ? "bg-white text-black"
                    : "border border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-600"
                }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <EmptyState
            eyebrow="Sincronizando"
            title="Carregando financeiro..."
            description="Estamos buscando os agendamentos para calcular receita realizada, previsao e perdas."
          />
        ) : !selectedMonthIsLoaded ? (
          <EmptyState
            eyebrow="Periodo fora da janela"
            title="Este mes nao foi carregado"
            description="Escolha um mes dentro da janela operacional para auditar receita com dados sincronizados."
          />
        ) : appointments.length === 0 ? (
          <EmptyState
            eyebrow="Sem receita"
            title="Sem dados financeiros ainda"
            description="Crie agendamentos e marque atendimentos como concluidos para formar receita realizada, previsao e perdas por cancelamento."
            actionLabel="Ir para agenda"
            actionTo="/agenda"
          />
        ) : monthAppointments.length === 0 ? (
          <EmptyState
            eyebrow="Periodo vazio"
            title="Sem movimentacao neste mes"
            description="Troque o mes para revisar outro periodo ou crie novos agendamentos para alimentar o financeiro."
          />
        ) : filteredAppointments.length === 0 ? (
          <EmptyState
            eyebrow="Filtro"
            title="Nada neste filtro"
            description="Troque o status para revisar outras movimentacoes deste periodo."
          />
        ) : (
          <div className="grid gap-3">
            {filteredAppointments.map((appointment) => {
              const clientName = appointment?.client?.name || appointment?.clientName || "Cliente";
              const serviceName = appointment?.service?.name || "Servico";
              const servicePrice = getServicePrice(appointment);
              const status = getAppointmentStatus(appointment);

              return (
                <article
                  key={appointment.id || `${appointment.date}-${appointment.time}-${serviceName}`}
                  className="rounded-2xl border border-gray-800 bg-gray-950 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-white">{clientName}</p>
                      <p className="mt-1 text-sm text-gray-400">
                        {serviceName} - {formatCurrencyBRL(servicePrice)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {appointment.date || "Data nao disponivel"} as {appointment.time || "Horario nao disponivel"}
                      </p>
                    </div>
                    <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${getAppointmentStatusClass(status)}`}>
                      {getAppointmentStatusLabel(status)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
