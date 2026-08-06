import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import { isActiveAppointment } from "../utils/appointments";
import { formatCurrencyBRL, formatDuration, pluralize } from "../utils/format";
import { SERVICE_LIMITS, findDuplicateServiceByName, getServiceCatalogPrice, validateServiceInput } from "../utils/services";

const durationOptions = [15, 30, 45, 60, 90, 120];

const servicePresets = [
  { name: "Corte masculino", price: 45, duration: 30 },
  { name: "Barba", price: 35, duration: 30 },
  { name: "Corte + barba", price: 75, duration: 60 },
  { name: "Sobrancelha", price: 20, duration: 15 },
];

const parseDate = (dateString) => {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const isFutureAppointment = (appointment) => {
  const appointmentDate = parseDate(appointment.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return isActiveAppointment(appointment) && appointmentDate && appointmentDate >= today;
};

export default function Services({
  services,
  archivedServices = [],
  appointments = [],
  addService,
  updateService,
  deleteService,
  restoreService,
  loading = false,
  notify = () => {},
}) {
  const [searchParams] = useSearchParams();
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("30");
  const [editingService, setEditingService] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState("30");
  const [confirmDeleteService, setConfirmDeleteService] = useState(null);
  const [savingService, setSavingService] = useState(false);
  const [editingServiceSaving, setEditingServiceSaving] = useState(false);
  const [archivingService, setArchivingService] = useState(false);
  const [restoringServiceId, setRestoringServiceId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const isSetupMode = searchParams.get("setup") === "services";
  const duplicateNewService = findDuplicateServiceByName(services, serviceName);
  const duplicateEditedService = editingService
    ? findDuplicateServiceByName(services, editName, editingService.id)
    : null;

  const appointmentsByService = useMemo(() => {
    return appointments.reduce((map, appointment) => {
      const serviceId = appointment.service?.id;
      if (!serviceId) return map;
      const key = String(serviceId);
      map[key] = map[key] || { total: 0, future: 0 };
      map[key].total += 1;
      if (isFutureAppointment(appointment)) map[key].future += 1;
      return map;
    }, {});
  }, [appointments]);

  const averagePrice = services.length
    ? Math.round(services.reduce((total, service) => total + getServiceCatalogPrice(service), 0) / services.length)
    : 0;

  const handleAdd = async () => {
    if (savingService) return;

    const validationError = validateServiceInput({
      name: serviceName,
      price: servicePrice,
      duration: serviceDuration,
    });
    if (validationError) {
      notify(validationError);
      return;
    }

    if (duplicateNewService) {
      notify("Ja existe um servico ativo com este nome.");
      return;
    }

    setSavingService(true);
    try {
      const saved = await addService(serviceName.trim(), servicePrice, serviceDuration);
      if (!saved) return;

      setServiceName("");
      setServicePrice("");
      setServiceDuration("30");
      setStatusMessage("Servico cadastrado com sucesso.");
    } finally {
      setSavingService(false);
    }
  };

  const applyPreset = (preset) => {
    setServiceName(preset.name);
    setServicePrice(String(preset.price));
    setServiceDuration(String(preset.duration));
  };

  const openEdit = (service) => {
    setEditingService(service);
    setEditName(service.name || "");
    setEditPrice(String(service.price || ""));
    setEditDuration(String(service.duration || 30));
    setStatusMessage("");
  };

  const closeEdit = () => {
    setEditingService(null);
    setEditName("");
    setEditPrice("");
    setEditDuration("30");
    setStatusMessage("");
  };

  const handleEditSave = async () => {
    if (editingServiceSaving) return;

    const validationError = validateServiceInput({
      name: editName,
      price: editPrice,
      duration: editDuration,
    });
    if (validationError) {
      notify(validationError);
      return;
    }

    if (duplicateEditedService) {
      notify("Ja existe outro servico ativo com este nome.");
      return;
    }

    setEditingServiceSaving(true);
    try {
      const saved = await updateService(editingService.id, {
        name: editName.trim(),
        price: Number(editPrice),
        duration: Number(editDuration) || 30,
      });
      if (!saved) return;

      setStatusMessage("Servico atualizado com sucesso.");
      setTimeout(closeEdit, 800);
    } finally {
      setEditingServiceSaving(false);
    }
  };

  const futureAppointmentsForService = (serviceId) => appointmentsByService[String(serviceId)]?.future || 0;

  const restoreArchivedService = async (serviceId) => {
    if (restoringServiceId) return;

    setRestoringServiceId(serviceId);
    try {
      const restored = await restoreService?.(serviceId);
      if (restored) setStatusMessage("Servico restaurado para o catalogo ativo.");
    } finally {
      setRestoringServiceId("");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteService || archivingService) return;
    if (futureAppointmentsForService(confirmDeleteService.id) > 0) return;

    setArchivingService(true);
    try {
      const archived = await deleteService(confirmDeleteService.id);
      if (archived !== false) setConfirmDeleteService(null);
    } finally {
      setArchivingService(false);
    }
  };

  const deleteWarningCount = confirmDeleteService ? futureAppointmentsForService(confirmDeleteService.id) : 0;

  return (
    <main className="flex-1 overflow-y-auto p-4 text-white sm:p-6 lg:p-8">
      <div className="mb-8 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Catalogo</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Servicos</h1>
            <p className="mt-2 max-w-2xl text-gray-400">
              Controle preco, duracao e disponibilidade dos servicos usados no agendamento.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Publicados</p>
              <p className="mt-2 text-2xl font-black">{loading ? "..." : services.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Media</p>
              <p className="mt-2 text-2xl font-black">{formatCurrencyBRL(averagePrice)}</p>
            </div>
          </div>
        </div>
        {isSetupMode && services.length === 0 && !loading && (
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">Etapa de ativacao</p>
            <h2 className="mt-2 text-xl font-bold">Cadastre o primeiro servico para liberar o link publico</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Use uma sugestao pronta ou informe nome, preco e duracao. Depois disso, falta cadastrar a equipe.
            </p>
          </div>
        )}
        {isSetupMode && services.length > 0 && (
          <div className="flex flex-col gap-3 rounded-3xl border border-emerald-600/40 bg-emerald-950/40 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-200">Servico pronto</p>
              <p className="mt-1 text-sm text-gray-300">Agora cadastre pelo menos um barbeiro para receber agendamentos.</p>
            </div>
            <Link
              to="/barbeiros?setup=barbers"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              Ir para equipe
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.25em] text-gray-500">Novo item</p>
            <h2 className="mt-2 text-2xl font-bold">Cadastrar servico</h2>
            <p className="mt-2 text-sm text-gray-400">
              Defina preco e duracao para evitar conflito de horarios na agenda.
            </p>
          </div>

          {!loading && services.length === 0 && (
            <div className="mb-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Comece rapido</p>
              <div className="mt-3 grid gap-2">
                {servicePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-2xl border border-gray-800 bg-gray-950 px-3 py-2 text-left text-sm text-gray-200 transition hover:border-indigo-500"
                  >
                    {preset.name} - {formatCurrencyBRL(preset.price)} - {formatDuration(preset.duration)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4">
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-300">Nome</span>
              <input
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                placeholder="Ex: Corte"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-gray-300">Preco</span>
              <input
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                type="number"
                min="0"
                max={SERVICE_LIMITS.priceMax}
                placeholder="R$"
                value={servicePrice}
                onChange={(e) => setServicePrice(e.target.value)}
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-gray-300">Duracao</span>
              <select
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                value={serviceDuration}
                onChange={(e) => setServiceDuration(e.target.value)}
              >
                {durationOptions.map((duration) => (
                  <option key={duration} value={duration}>
                    {formatDuration(duration)}
                  </option>
                ))}
              </select>
            </label>

            <button type="button"
              className={`w-full rounded-2xl py-4 font-semibold transition ${
                duplicateNewService || savingService
                  ? "cursor-not-allowed bg-gray-700 text-gray-400"
                  : "bg-white text-black hover:bg-gray-200"
              }`}
              onClick={handleAdd}
              disabled={Boolean(duplicateNewService) || savingService}
            >
              {savingService ? "Salvando servico..." : "Adicionar servico"}
            </button>
            {duplicateNewService && (
              <p className="rounded-2xl border border-yellow-700 bg-yellow-950/50 p-3 text-sm text-yellow-100">
                Ja existe um servico ativo chamado {duplicateNewService.name}.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Servicos cadastrados</h2>
              <p className="mt-2 text-gray-400">Itens prontos para agenda publica, encaixes e financeiro.</p>
            </div>
            <span className="text-sm text-gray-400">
              {loading ? "Carregando..." : pluralize(services.length, "servico")}
            </span>
          </div>

          {loading ? (
            <EmptyState
              eyebrow="Sincronizando"
              title="Carregando servicos..."
              description="Estamos buscando o catalogo salvo no Firestore."
            />
          ) : services.length === 0 ? (
            <EmptyState
              eyebrow="Catalogo vazio"
              title="Nenhum servico cadastrado"
              description="Cadastre pelo menos um servico com preco e duracao para liberar a agenda publica e evitar conflito de horarios."
              actionLabel="Usar sugestao"
              onAction={() => applyPreset(servicePresets[0])}
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {services.map((service) => {
                const futureCount = futureAppointmentsForService(service.id);
                const totalUsage = appointmentsByService[String(service.id)]?.total || 0;
                return (
                  <article key={service.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">{service.name}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          <span className="rounded-full bg-white/5 px-3 py-1 text-gray-300">{formatCurrencyBRL(service.price)}</span>
                          <span className="rounded-full bg-white/5 px-3 py-1 text-gray-300">{formatDuration(service.duration || 30)}</span>
                          <span className="rounded-full bg-white/5 px-3 py-1 text-gray-400">{pluralize(totalUsage, "uso")}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(service)}
                          className="rounded-2xl border border-indigo-500 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/15"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteService(service)}
                          className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                            futureCount
                              ? "cursor-not-allowed border-gray-700 bg-gray-900 text-gray-400"
                              : "border-red-500 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                          }`}
                          disabled={futureCount > 0}
                        >
                          Arquivar
                        </button>
                      </div>
                    </div>
                    {futureCount > 0 && (
                      <p className="mt-4 rounded-2xl border border-yellow-700 bg-yellow-950/50 p-3 text-sm text-yellow-200">
                        Este servico tem {pluralize(futureCount, "agendamento")} {futureCount === 1 ? "futuro" : "futuros"} e nao pode ser arquivado.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {archivedServices.length > 0 && (
          <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6 xl:col-span-2">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-gray-500">Recuperacao</p>
                <h2 className="mt-2 text-2xl font-bold">Servicos arquivados</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Restaurar um servico coloca ele de volta na agenda interna e na pagina publica de agendamento.
                </p>
              </div>
              <span className="w-fit rounded-full bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-gray-400">
                {archivedServices.length} arquivados
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {archivedServices.map((service) => (
                <article key={service.id} className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/70 p-4">
                  <p className="font-semibold text-white">{service.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-white/5 px-3 py-1 text-gray-400">{formatCurrencyBRL(service.price)}</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-gray-400">{formatDuration(service.duration || 30)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreArchivedService(service.id)}
                    disabled={Boolean(restoringServiceId)}
                    className={`mt-4 w-full rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                      restoringServiceId
                        ? "cursor-not-allowed border-gray-700 bg-gray-900 text-gray-500"
                        : "border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:border-emerald-500"
                    }`}
                  >
                    {restoringServiceId === service.id ? "Restaurando..." : "Restaurar servico"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-xl rounded-3xl border border-gray-800 bg-gray-950 p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-service-title"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 id="edit-service-title" className="text-2xl font-bold">Editar servico</h3>
                <p className="mt-1 text-gray-400">Atualize nome, preco e duracao do servico selecionado.</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                aria-label="Fechar edicao do servico"
                className="rounded-full border border-gray-700 bg-gray-900 px-3 py-2 text-gray-300 hover:border-white/20"
              >
                X
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <input
                className="w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do servico"
              />
              <input
                className="w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none"
                type="number"
                min="0"
                max={SERVICE_LIMITS.priceMax}
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="Preco"
              />
              <select
                className="w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none"
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
              >
                {durationOptions.map((duration) => (
                  <option key={duration} value={duration}>
                    {formatDuration(duration)}
                  </option>
                ))}
              </select>
            </div>
            {duplicateEditedService && (
              <p className="mt-4 rounded-2xl border border-yellow-700 bg-yellow-950/50 p-3 text-sm text-yellow-100">
                Ja existe outro servico ativo chamado {duplicateEditedService.name}.
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-3xl border border-gray-700 bg-gray-900 px-6 py-3 text-sm font-semibold text-gray-300 transition hover:border-white/20"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={Boolean(duplicateEditedService) || editingServiceSaving}
                className={`rounded-3xl px-6 py-3 text-sm font-semibold transition ${
                  duplicateEditedService || editingServiceSaving
                    ? "cursor-not-allowed bg-gray-700 text-gray-400"
                    : "bg-white text-black hover:bg-gray-200"
                }`}
              >
                {editingServiceSaving ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
            {statusMessage && <p className="mt-4 text-sm text-emerald-300">{statusMessage}</p>}
          </div>
        </div>
      )}

      {confirmDeleteService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-lg rounded-3xl border border-gray-800 bg-gray-950 p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-service-title"
          >
            <div className="mb-6">
              <h3 id="delete-service-title" className="text-2xl font-bold">Arquivar servico</h3>
              <p className="mt-2 text-gray-400">
                Tem certeza de que deseja arquivar <span className="font-semibold text-white">{confirmDeleteService.name}</span>?
              </p>
            </div>

            {deleteWarningCount > 0 ? (
              <div className="rounded-3xl border border-yellow-500 bg-yellow-950 p-4 text-yellow-200">
                <p className="font-semibold">Arquivamento bloqueado</p>
                <p className="mt-2 text-sm">
                  Ha {pluralize(deleteWarningCount, "agendamento")} {deleteWarningCount === 1 ? "futuro" : "futuros"} usando este servico. Remova ou altere esses agendamentos antes de arquivar.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-300">
                Este servico sera arquivado da base ativa. O historico de agendamentos permanece preservado.
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmDeleteService(null)}
                className="rounded-3xl border border-gray-700 bg-gray-900 px-6 py-3 text-sm font-semibold text-gray-300 transition hover:border-white/20"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={deleteWarningCount > 0 || archivingService}
                className={`rounded-3xl px-6 py-3 text-sm font-semibold transition ${
                  deleteWarningCount > 0 || archivingService
                    ? "cursor-not-allowed border border-gray-700 bg-gray-900 text-gray-500"
                    : "bg-red-500 text-white hover:bg-red-600"
                }`}
              >
                {archivingService ? "Arquivando..." : "Confirmar arquivamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
