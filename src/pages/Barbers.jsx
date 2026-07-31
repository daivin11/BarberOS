import { useEffect, useMemo, useState } from "react";
import { collection, addDoc, updateDoc, doc, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../services/firebase";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../hooks/useAuth";
import { ACTIVE_APPOINTMENT_STATUSES, countActiveAppointmentsByField } from "../utils/appointments";
import { normalizeBarberInput, validateBarberInput } from "../utils/barbers";
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
  const [barbers, setBarbers] = useState(syncedBarbers);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [avatar, setAvatar] = useState("");
  const [editingBarber, setEditingBarber] = useState(null);
  const [deleteBarber, setDeleteBarber] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setBarbers(syncedBarbers);
  }, [syncedBarbers]);

  const activeAppointmentsByBarber = useMemo(
    () => countActiveAppointmentsByField(appointments, "barberId"),
    [appointments]
  );

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
    const barberInput = normalizeBarberInput({ name, specialty, avatar });
    const validationError = validateBarberInput(barberInput);

    if (validationError) {
      notify(validationError);
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

    try {
      if (editingBarber) {
        const barberRef = doc(db, "barbers", editingBarber.id);
        await updateDoc(barberRef, barberData);
        const nextBarbers = barbers.map((barber) =>
          barber.id === editingBarber.id ? { ...barber, ...barberData } : barber
        );
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
        syncBarbers([{ id: docRef.id, ...barberData, createdAt }, ...barbers]);
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
    if (!deleteBarber) return;

    const activeCount = activeAppointmentsByBarber[String(deleteBarber.id)] || 0;
    if (activeCount > 0) {
      notify("Este barbeiro tem agendamentos ativos. Reagende, conclua ou cancele esses horarios antes de arquivar.");
      return;
    }

    if (!user) {
      notify("Sessao expirada. Entre novamente para arquivar equipe.");
      return;
    }

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
    } catch (error) {
      reportError(error, { source: "barbers", action: "check-barber-active-appointments" });
      notify("Nao foi possivel verificar agendamentos ativos deste barbeiro. Tente novamente.");
      return;
    }

    try {
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
      reportError(error, { source: "barbers", action: "archive-barber" });
      notify("Erro ao arquivar barbeiro. Tente novamente.");
    }
  };

  const restoreArchivedBarber = async (barberId) => {
    const restored = await restoreBarber?.(barberId);
    if (restored) setStatusMessage("Barbeiro restaurado para a equipe ativa.");
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
              className="w-full rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              {editingBarber ? "Salvar alteracoes" : "Adicionar barbeiro"}
            </button>
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
                    className="mt-4 w-full rounded-2xl border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-500"
                  >
                    Restaurar barbeiro
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
                className="rounded-3xl bg-red-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                Confirmar arquivamento
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
