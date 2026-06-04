import AppointmentCard from "../components/AppointmentCard";

export default function Schedule({
  appointments,
  clients,
  services,
  barbers = [],
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
}) {
  const needsData = clients.length === 0 || services.length === 0 || barbers.length === 0;
  const activeAppointments = appointments.filter((appointment) => appointment.status !== "cancelled");
  const assignedAppointments = appointments.filter(
    (appointment) => appointment.barberId || appointment.barberName
  ).length;
  const unassignedAppointments = appointments.length - assignedAppointments;
  const sortedAppointments = [...appointments].sort((first, second) => {
    const firstValue = `${first.date || ""} ${first.time || ""}`;
    const secondValue = `${second.date || ""} ${second.time || ""}`;
    return firstValue.localeCompare(secondValue);
  });

  return (
    <main className="flex-1 overflow-y-auto p-6 text-white md:p-8">
      <div className="mb-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agenda</h1>
            <p className="mt-2 max-w-2xl text-gray-400">
              Crie horarios, acompanhe a agenda por barbeiro e confirme clientes pelo WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Ativos</p>
              <p className="mt-3 text-3xl font-bold">{activeAppointments.length}</p>
            </div>
            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Barbeiros</p>
              <p className="mt-3 text-3xl font-bold">{barbers.length}</p>
            </div>
          </div>
        </div>

        {needsData && (
          <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-950 p-6 text-gray-400">
            <p className="font-semibold text-white">
              Para criar agendamentos, primeiro cadastre clientes, servicos e barbeiros.
            </p>
            <p className="mt-2 text-sm">
              Use Clientes, Servicos e Equipe no menu para adicionar os dados necessarios.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
          <h2 className="mb-4 text-2xl font-bold">Criar novo agendamento</h2>

          <div className="grid gap-4">
            <select
              className="rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
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

            <select
              className="rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
            >
              <option value="">Selecione o servico</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} - R$ {service.price}
                </option>
              ))}
            </select>

            <select
              className="rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
              value={selectedBarber}
              onChange={(e) => setSelectedBarber(e.target.value)}
            >
              <option value="">Selecione o barbeiro</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>

            <input
              className="rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
            />

            <input
              className="rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none"
              type="time"
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
            />

            <button
              className="mt-2 w-full rounded-2xl bg-white py-4 font-semibold text-black transition hover:bg-gray-200"
              onClick={addAppointment}
            >
              Criar agendamento
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Proximos agendamentos</h2>
              <p className="text-gray-400">
                Veja horarios, barbeiros responsaveis e confirme com clientes.
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

          {appointments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-950 p-8 text-center text-gray-400">
              Nenhum agendamento criado ainda.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {sortedAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  barbers={barbers}
                  sendWhatsApp={sendWhatsApp}
                  onStatusChange={updateAppointmentStatus}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
