import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import { getClientPhone, normalizeClientInput, validateClientInput } from "../utils/adminData";
import { createWhatsAppUrl, formatBrazilianPhone, normalizePhone } from "../utils/phone";

function getInitials(name = "CL") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function Clients({ clients, archivedClients = [], addClient, updateClient, deleteClient, restoreClient, loading }) {
  const [searchParams] = useSearchParams();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [editingClient, setEditingClient] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [archivingClient, setArchivingClient] = useState(false);
  const [restoringClientId, setRestoringClientId] = useState("");
  const isLoading = loading ?? false;
  const isSetupMode = searchParams.get("setup") === "clients";
  const cleanPhone = normalizePhone(clientPhone);
  const duplicatedClient = useMemo(
    () =>
      cleanPhone.length >= 10
        ? clients.find(
            (client) =>
              client.id !== editingClient?.id &&
              getClientPhone(client) === cleanPhone
          )
        : null,
    [cleanPhone, clients, editingClient?.id]
  );

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;

    return clients.filter((client) => {
      const name = String(client.name || "").toLowerCase();
      const phone = getClientPhone(client);
      return name.includes(term) || phone.includes(term) || normalizePhone(phone).includes(normalizePhone(term));
    });
  }, [clients, search]);

  const handleAddClient = async () => {
    if (savingClient) return;

    const clientInput = normalizeClientInput({ name: clientName, phone: clientPhone });
    const validationError = validateClientInput(clientInput);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (duplicatedClient) {
      setFormError(`Este telefone ja esta cadastrado para ${duplicatedClient.name}.`);
      return;
    }

    setFormError("");
    setSavingClient(true);

    try {
      const success = editingClient
        ? await updateClient(editingClient.id, clientInput)
        : await addClient(clientInput.name, clientInput.phone);

      if (success) {
        setClientName("");
        setClientPhone("");
        setEditingClient(null);
        setStatusMessage(editingClient ? "Cliente atualizado com sucesso." : "Cliente cadastrado com sucesso.");
      }
    } finally {
      setSavingClient(false);
    }
  };

  const startEdit = (client) => {
    setEditingClient(client);
    setClientName(client.name || "");
    setClientPhone(getClientPhone(client));
    setFormError("");
    setStatusMessage("");
  };

  const resetForm = () => {
    setEditingClient(null);
    setClientName("");
    setClientPhone("");
    setFormError("");
  };

  const focusClientName = () => {
    document.querySelector('input[placeholder="Nome do cliente"]')?.focus();
  };

  const restoreArchivedClient = async (clientId) => {
    if (restoringClientId) return;

    setRestoringClientId(clientId);
    try {
      const success = await restoreClient?.(clientId);
      if (success) setStatusMessage("Cliente restaurado para a base ativa.");
    } finally {
      setRestoringClientId("");
    }
  };

  const createClientWhatsAppLink = (client) =>
    createWhatsAppUrl({
      phone: getClientPhone(client),
      message: `Ola, ${client.name || "cliente"}! Aqui e da barbearia. Quer agendar um horario?`,
    });

  const confirmDelete = async () => {
    if (!deleteTarget || archivingClient) return;

    setArchivingClient(true);
    try {
      const success = await deleteClient(deleteTarget.id);
      if (success) {
        setDeleteTarget(null);
        setStatusMessage("Cliente arquivado com sucesso.");
        if (editingClient?.id === deleteTarget.id) resetForm();
      }
    } finally {
      setArchivingClient(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 text-white sm:p-6 lg:p-8">
      <div className="mb-8 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Relacionamento</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Clientes</h1>
            <p className="mt-2 max-w-2xl text-gray-400">
              Organize a base de contatos que alimenta agenda, retorno e campanhas pelo WhatsApp.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Base</p>
            <p className="mt-2 text-2xl font-black">{isLoading ? "..." : clients.length}</p>
          </div>
        </div>
        {isSetupMode && clients.length === 0 && !isLoading && (
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">Etapa de ativacao</p>
            <h2 className="mt-2 text-xl font-bold">Cadastre um cliente para operar encaixes internos</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Clientes publicos entram pela pagina de agendamento, mas uma base inicial ajuda a testar telefone, agenda e WhatsApp.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
              {editingClient ? "Edicao" : "Cadastro rapido"}
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {editingClient ? "Editar cliente" : "Novo cliente"}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              {editingClient
                ? "Atualize nome e telefone sem duplicar contatos."
                : "Cadastre clientes recebidos no balcao, telefone ou WhatsApp."}
            </p>
          </div>

          <div className="grid gap-4">
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-300">Nome</span>
              <input
                type="text"
                autoComplete="name"
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                placeholder="Nome do cliente"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-gray-300">Telefone</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                placeholder="DDD + numero"
                value={clientPhone}
                onChange={(event) => {
                  setClientPhone(event.target.value);
                  setFormError("");
                }}
              />
            </label>

            {duplicatedClient && (
              <div className="rounded-2xl border border-yellow-700 bg-yellow-950/50 p-3 text-sm text-yellow-100">
                Telefone ja usado por {duplicatedClient.name}. Evite duplicar o cadastro.
              </div>
            )}

            {formError && (
              <div className="rounded-2xl border border-red-800 bg-red-950/70 p-3 text-sm text-red-200">
                {formError}
              </div>
            )}

            <button
              type="button"
              className={`w-full rounded-2xl py-4 font-semibold transition ${
                duplicatedClient || savingClient
                  ? "cursor-not-allowed bg-gray-700 text-gray-400"
                  : "bg-white text-black hover:bg-gray-200"
              }`}
              onClick={handleAddClient}
              disabled={Boolean(duplicatedClient) || savingClient}
            >
              {savingClient ? (editingClient ? "Salvando alteracao..." : "Salvando cliente...") : editingClient ? "Salvar alteracao" : "Adicionar cliente"}
            </button>

            {editingClient && (
              <button
                type="button"
                onClick={resetForm}
                className="w-full rounded-2xl border border-gray-700 bg-gray-950 py-4 font-semibold text-gray-200 transition hover:border-gray-500"
              >
                Cancelar edicao
              </button>
            )}

            {statusMessage && (
              <div className="rounded-2xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">
                {statusMessage}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Base de clientes</h2>
              <p className="mt-2 text-gray-400">Busque por nome ou telefone antes de criar duplicados.</p>
            </div>
            <input
              className="w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm outline-none transition placeholder:text-gray-500 focus:border-indigo-500 lg:max-w-xs"
              placeholder="Buscar cliente"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {isLoading ? (
            <EmptyState
              eyebrow="Sincronizando"
              title="Carregando clientes..."
              description="Estamos buscando sua base de contatos no Firestore."
            />
          ) : clients.length === 0 ? (
            <EmptyState
              eyebrow="Base vazia"
              title="Nenhum cliente cadastrado"
              description="Cadastre o primeiro cliente para criar encaixes internos, manter historico e evitar depender so do WhatsApp."
              actionLabel="Cadastrar cliente"
              onAction={focusClientName}
            />
          ) : filteredClients.length === 0 ? (
            <EmptyState
              eyebrow="Busca"
              title="Nenhum resultado"
              description="Tente buscar por outro nome ou telefone antes de criar um novo cadastro."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredClients.map((client) => (
                <article key={client.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-indigo-200">
                      {getInitials(client.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{client.name}</p>
                      <p className="mt-1 text-sm text-gray-400">{formatBrazilianPhone(getClientPhone(client))}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <a
                      href={createClientWhatsAppLink(client)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-center text-sm font-semibold text-emerald-200 transition hover:border-emerald-500"
                    >
                      WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => startEdit(client)}
                      className="rounded-2xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-200 transition hover:border-gray-500"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(client)}
                      className="rounded-2xl border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-200 transition hover:border-red-500"
                    >
                      Arquivar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {archivedClients.length > 0 && (
          <section className="rounded-3xl xl:col-span-2 border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-gray-500">Recuperacao</p>
                <h2 className="mt-2 text-2xl font-bold">Clientes arquivados</h2>
                <p className="mt-2 text-sm text-gray-400">
                  Restaure contatos arquivados por engano. Se o telefone ja estiver em outro cliente ativo, a restauracao sera bloqueada para evitar duplicidade.
                </p>
              </div>
              <span className="w-fit rounded-full bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-gray-400">
                {archivedClients.length} arquivados
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {archivedClients.map((client) => (
                <article key={client.id} className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/70 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-sm font-black text-gray-300">
                      {getInitials(client.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{client.name}</p>
                      <p className="mt-1 text-sm text-gray-500">{formatBrazilianPhone(getClientPhone(client))}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreArchivedClient(client.id)}
                    disabled={Boolean(restoringClientId)}
                    className={`mt-4 w-full rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                      restoringClientId
                        ? "cursor-not-allowed border-gray-700 bg-gray-900 text-gray-500"
                        : "border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:border-emerald-500"
                    }`}
                  >
                    {restoringClientId === client.id ? "Restaurando..." : "Restaurar cliente"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-client-title"
          >
            <p className="text-sm uppercase tracking-[0.3em] text-red-300">Arquivar cliente</p>
            <h2 id="delete-client-title" className="mt-4 text-2xl font-bold">Arquivar {deleteTarget.name}?</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Clientes com agendamentos pendentes ou confirmados nao podem ser arquivados. Esta acao remove o contato da base ativa, mas preserva o historico.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-gray-500"
              >
                Manter cliente
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={archivingClient}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${
                  archivingClient ? "cursor-not-allowed bg-red-900 text-red-200" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {archivingClient ? "Arquivando..." : "Arquivar cliente"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
