import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, addDoc, updateDoc, doc, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../services/firebase";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../hooks/useAuth";
import { sortByName, upsertById } from "../utils/adminData";
import { ACTIVE_APPOINTMENT_STATUSES, countActiveAppointmentsByField } from "../utils/appointments";
import { findDuplicateBarberByName, normalizeBarberInput, validateBarberInput } from "../utils/barbers";
import { pluralize } from "../utils/format";
import { PROFILE_LIMITS } from "../utils/profileValidation";
import { reportError, trackEvent } from "../utils/telemetry";

function getInitials(name = "EQ") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function Barbers({
  barbers: syncedBarbers = [],
  archivedBarbers = [],
  appointments = [],
  loading = false,
  onBarbersChange,
  onArchivedBarbersChange,
  restoreBarber,
  recordAuditLog,
  notify = () => {},
}) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [barbers, setBarbers] = useState(syncedBarbers);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [avatar, setAvatar] = useState("");
  const [editingBarber, setEditingBarber] = useState(null);
  const [deleteBarber, setDeleteBarber] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [savingBarber, setSavingBarber] = useState(false);
  const [archivingBarber, setArchivingBarber] = useState(false);
  const [restoringBarberId, setRestoringBarberId] = useState("");
  const isSetupMode = searchParams.get("setup") === "barbers";
  const duplicateBarber = findDuplicateBarberByName(barbers, name, editingBarber?.id);

  useEffect(() => {
    setBarbers(syncedBarbers);
  }, [syncedBarbers]);

  const activeAppointmentsByBarber = useMemo(
    () => countActiveAppointmentsByField(appointments, "barberId"),
    [appointments]
  );
  const deleteBarberActiveCount = deleteBarber
    ? activeAppointmentsByBarber[String(deleteBarber.id)] || 0
    : 0;

  const syncBarbers = (nextBarbers) => {
    setBarbers(nextBarbers);
    onBarbersChange?.(nextBarbers);
  };

  const syncArchivedBarbers = (nextBarbers) => {
    onArchivedBarbersChange?.(nextBarbers);
  };

  const resetForm = (clearStatus = true) => {
    setName("");
    setSpecialty("");
    setAvatar("");
    setEditingBarber(null);
    if (clearStatus) setStatusMessage("");
  };

  const handleSave = async () => {
    if (savingBarber) return;

    const barberInput = normalizeBarberInput({ name, specialty, avatar });
    const validationError = validateBarberInput(barberInput);

    if (validationError) {
      notify(validationError);
      return;
    }

    if (duplicateBarber) {
      notify(
        editingBarber
          ? "Ja existe outro barbeiro ativo com este nome."
          : "Ja existe um barbeiro ativo com este nome."
      );
      return;
    }

    if (!user) {
      notify("Sessao expirada. Entre novamente para cadastrar equipe.");
      return;
    }

    const barberData = {
      name: barberInput.name,
      specialty: barberInput.specialty,
      avatar: barberInput.avatar,
      ownerId: user.uid,
      updatedAt: new Date(),
    };

    setSavingBarber(true);
    try {
      if (editingBarber) {
        const barberRef = doc(db, "barbers", editingBarber.id);
        await updateDoc(barberRef, barberData);
        const nextBarbers = sortByName(upsertById(barbers, { id: editingBarber.id, ...barberData }));
        syncBarbers(nextBarbers);
        setStatusMessage("Barbeiro atualizado com sucesso.");
        await recordAuditLog?.({
          action: "barber_updated",
          entityType: "barber",
          entityId: editingBarber.id,
          entityLabel: barberInput.name,
          summary: "Barbeiro atualizado na equipe.",
          source: "barbers",
        });
      } else {
        const createdAt = new Date();
        const docRef = await addDoc(collection(db, "barbers"), {
          ...barberData,
          createdAt,
          isArchived: false,
        });
        syncBarbers(sortByName(upsertById(barbers, { id: docRef.id, ...barberData, createdAt })));
        setStatusMessage("Barbeiro cadastrado com sucesso.");
        await recordAuditLog?.({
          action: "barber_created",
          entityType: "barber",
          entityId: docRef.id,
          entityLabel: barberInput.name,
          summary: "Barbeiro cadastrado na equipe ativa.",
          source: "barbers",
        });
      }
      trackEvent(editingBarber ? "barber_updated" : "barber_created", {
        source: "barbers",
        action: editingBarber ? "update-barber" : "create-barber",
      });
      resetForm(false);
    } catch (error) {
      reportError(error, {
        source: "barbers",
        action: editingBarber ? "update-barber" : "create-barber",
      });
      notify("Erro ao salvar barbeiro. Tente novamente.");
    } finally {
      setSavingBarber(false);
    }
  };

  const handleEdit = (barber) => {
    setEditingBarber(barber);
    setName(barber.name || "");
    setSpecialty(barber.specialty || "");
    setAvatar(barber.avatar || "");
    setStatusMessage("");
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteBarber || archivingBarber) return;

    const activeCount = activeAppointmentsByBarber[String(deleteBarber.id)] || 0;
    if (activeCount > 0) {
      notify("Este barbeiro tem agendamentos ativos. Reagende, conclua ou cancele esses horarios antes de arquivar.");
      return;
    }

    if (!user) {
      notify("Sessao expirada. Entre novamente para arquivar equipe.");
      return;
    }

    setArchivingBarber(true);
    try {
      const activeAppointmentQuery = query(
        collection(db, "appointments"),
        where("userId", "==", user.uid),
        where("barberId", "==", deleteBarber.id),
        where("status", "in", ACTIVE_APPOINTMENT_STATUSES),
        limit(1)
      );
      const activeAppointmentSnapshot = await getDocs(activeAppointmentQuery);
      if (!activeAppointmentSnapshot.empty) {
        notify("Este barbeiro tem agendamentos ativos fora da tela atual. Reagende, conclua ou cancele antes de arquivar.");
        return;
      }

      const archivedAt = new Date();
      const barberRef = doc(db, "barbers", deleteBarber.id);
      await updateDoc(barberRef, { isArchived: true, archivedAt, updatedAt: archivedAt });
      const nextBarbers = barbers.filter((barber) => barber.id !== deleteBarber.id);
      syncBarbers(nextBarbers);
      syncArchivedBarbers([{ ...deleteBarber, isArchived: true, archivedAt, updatedAt: archivedAt }, ...archivedBarbers]);
      if (editingBarber?.id === deleteBarber.id) resetForm();
      setDeleteBarber(null);
      trackEvent("barber_archived", { source: "barbers", action: "archive-barber" });
      await recordAuditLog?.({
        action: "barber_archived",
        entityType: "barber",
        entityId: deleteBarber.id,
        entityLabel: deleteBarber.name,
        summary: "Barbeiro arquivado da equipe ativa.",
        source: "barbers",
      });
    } catch (error) {
      reportError(error, { source: "barbers", action: "archive-barber-or-check-active-appointments" });
      notify("Nao foi possivel arquivar este barbeiro. Verifique os agendamentos ativos e tente novamente.");
    } finally {
      setArchivingBarber(false);
    }
  };

  const restoreArchivedBarber = async (barberId) => {
    if (restoringBarberId) return;

    setRestoringBarberId(barberId);
    try {
      const restored = await restoreBarber?.(barberId);
      if (restored) setStatusMessage("Barbeiro restaurado para a equipe ativa.");
    } finally {
      setRestoringBarberId("");
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 text-white sm:p-6 lg:p-8">
      <div className="mb-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Equipe</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Barbeiros</h1>
            <p className="mt-2 max-w-2xl text-gray-400">
              Cadastre profissionais, especialidades e identidade visual usada na agenda publica.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Ativos</p>
            <p className="mt-2 text-2xl font-black">{loading ? "..." : barbers.length}</p>
          </div>
        </div>
        {isSetupMode && barbers.length === 0 && !loading && (
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">Etapa de ativacao</p>
            <h2 className="mt-2 text-xl font-bold">Cadastre quem atende na agenda</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Cada barbeiro vira uma opcao no link publico e uma coluna na agenda diaria.
            </p>
          </div>
        )}
        {isSetupMode && barbers.length > 0 && (
          <div className="flex flex-col gap-3 rounded-3xl border border-emerald-600/40 bg-emerald-950/40 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-200">Equipe pronta</p>
              <p className="mt-1 text-sm text-gray-300">Crie um agendamento teste para validar o fluxo completo.</p>
            </div>
            <Link
              to="/agenda?setup=first-booking"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              Ir para agenda
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
                {editingBarber ? "Edicao" : "Novo profissional"}
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {editingBarber ? "Editar barbeiro" : "Cadastrar barbeiro"}
              </h2>
              <p className="mt-2 text-sm text-gray-400">Especialidade e foto aparecem na pagina publica.</p>
            </div>
            {editingBarber && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-gray-700 bg-gray-950 px-4 py-2 text-sm text-gray-300 hover:border-white"
              >
                Cancelar
              </button>
            )}
          </div>

          <div className="grid gap-4">
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-300">Nome</span>
              <input
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                placeholder="Nome do barbeiro"
                value={name}
                maxLength={PROFILE_LIMITS.nameMax}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-300">Especialidade</span>
              <input
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                placeholder="Ex: Corte e barba"
                value={specialty}
                maxLength={PROFILE_LIMITS.nameMax}
                onChange={(e) => setSpecialty(e.target.value)}
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-300">Avatar</span>
              <input
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                placeholder="URL da imagem opcional"
                value={avatar}
                maxLength={PROFILE_LIMITS.urlMax}
                onChange={(e) => setAvatar(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={handleSave}
              disabled={Boolean(duplicateBarber) || savingBarber}
              className={`w-full rounded-2xl px-4 py-4 text-sm font-semibold transition ${
                duplicateBarber || savingBarber
                  ? "cursor-not-allowed bg-gray-700 text-gray-400"
                  : "bg-white text-black hover:bg-gray-200"
              }`}
            >
              {savingBarber ? (editingBarber ? "Salvando alteracoes..." : "Salvando barbeiro...") : editingBarber ? "Salvar alteracoes" : "Adicionar barbeiro"}
            </button>
            {duplicateBarber && (
              <p className="rounded-2xl border border-yellow-700 bg-yellow-950/50 p-3 text-sm text-yellow-100">
                Ja existe um barbeiro ativo chamado {duplicateBarber.name}.
              </p>
            )}
            {statusMessage && <p className="text-sm text-emerald-300">{statusMessage}</p>}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Equipe cadastrada</h2>
              <p className="mt-2 text-gray-400">Profissionais disponiveis para agenda interna e publica.</p>
            </div>
            <span className="w-fit rounded-full bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-gray-400">
              {loading ? "Carregando..." : `${barbers.length} cadastrados`}
            </span>
          </div>

          {loading ? (
            <EmptyState
              eyebrow="Sincronizando"
              title="Carregando barbeiros..."
              description="Estamos buscando os profissionais cadastrados para sua agenda."
            />
          ) : barbers.length === 0 ? (
            <EmptyState
              eyebrow="Equipe vazia"
              title="Nenhum barbeiro cadastrado"
              description="Cadastre pelo menos um profissional para liberar colunas na agenda e permitir que clientes escolham por quem querem ser atendidos."
              actionLabel="Cadastrar barbeiro"
              onAction={() => document.querySelector('input[placeholder="Nome do barbeiro"]')?.focus()}
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {barbers.map((barber) => (
                <article key={barber.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white/10 text-xl font-black text-indigo-300">
                      {barber.avatar ? (
                        <img src={barber.avatar} alt={barber.name} className="h-16 w-16 rounded-3xl object-cover" />
                      ) : (
                        getInitials(barber.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{barber.name}</p>
                      <p className="mt-1 text-sm text-gray-400">{barber.specialty || "Especialista"}</p>
                      {(activeAppointmentsByBarber[String(barber.id)] || 0) > 0 && (
                        <p className="mt-2 text-xs text-yellow-300">
                          {pluralize(activeAppointmentsByBarber[String(barber.id)], "agendamento")}{" "}
                          {activeAppointmentsByBarber[String(barber.id)] === 1 ? "ativo" : "ativos"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(barber)}
                      className="rounded-2xl border border-indigo-500 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/15"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteBarber(barber)}
                      disabled={(activeAppointmentsByBarber[String(barber.id)] || 0) > 0}
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                        (activeAppointmentsByBarber[String(barber.id)] || 0) > 0
                          ? "cursor-not-allowed border-gray-700 bg-gray-900 text-gray-500"
                          : "border-red-500 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                      }`}
                    >
                      Arquivar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {archivedBarbers.length > 0 && (
          <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6 xl:col-span-2">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-gray-500">Recuperacao</p>
                <h2 className="mt-2 text-2xl font-bold">Barbeiros arquivados</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Restaurar um profissional coloca ele de volta na agenda interna e como opcao na pagina publica.
                </p>
              </div>
              <span className="w-fit rounded-full bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-gray-400">
                {archivedBarbers.length} arquivados
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {archivedBarbers.map((barber) => (
                <article key={barber.id} className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/70 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white/5 text-lg font-black text-gray-300">
                      {barber.avatar ? (
                        <img src={barber.avatar} alt={barber.name} className="h-14 w-14 rounded-3xl object-cover grayscale" />
                      ) : (
                        getInitials(barber.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{barber.name}</p>
                      <p className="mt-1 text-sm text-gray-500">{barber.specialty || "Especialista"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreArchivedBarber(barber.id)}
                    disabled={Boolean(restoringBarberId)}
                    className={`mt-4 w-full rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                      restoringBarberId
                        ? "cursor-not-allowed border-gray-700 bg-gray-900 text-gray-500"
                        : "border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:border-emerald-500"
                    }`}
                  >
                    {restoringBarberId === barber.id ? "Restaurando..." : "Restaurar barbeiro"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {deleteBarber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-lg rounded-3xl border border-gray-800 bg-gray-950 p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-barber-title"
          >
            <h3 id="delete-barber-title" className="text-2xl font-bold">Arquivar barbeiro</h3>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Voce esta prestes a arquivar <span className="font-semibold text-white">{deleteBarber.name}</span>. Essa acao arquiva o profissional e so e permitida quando nao ha agendamentos ativos para ele.
            </p>
            {deleteBarberActiveCount > 0 && (
              <div className="mt-5 rounded-3xl border border-yellow-500 bg-yellow-950 p-4 text-yellow-200">
                <p className="font-semibold">Arquivamento bloqueado</p>
                <p className="mt-2 text-sm">
                  Ha {pluralize(deleteBarberActiveCount, "agendamento")}{" "}
                  {deleteBarberActiveCount === 1 ? "ativo" : "ativos"} para este barbeiro.
                  Reagende, conclua ou cancele antes de arquivar.
                </p>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteBarber(null)}
                className="rounded-3xl border border-gray-700 bg-gray-900 px-6 py-3 text-sm font-semibold text-gray-300 transition hover:border-white/20"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={archivingBarber || deleteBarberActiveCount > 0}
                className={`rounded-3xl px-6 py-3 text-sm font-semibold text-white transition ${
                  archivingBarber || deleteBarberActiveCount > 0
                    ? "cursor-not-allowed bg-red-900 text-red-200"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {archivingBarber ? "Arquivando..." : "Confirmar arquivamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
