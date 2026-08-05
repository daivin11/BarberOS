const EXPORT_SCHEMA_VERSION = 2;
const EXPORT_PRIVACY_NOTICE =
  "Este arquivo contem dados pessoais de clientes e deve ser armazenado com controle de acesso.";

const toExportValue = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toExportValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, toExportValue(entryValue)])
    );
  }
  return value;
};

export const createWorkspaceExportPayload = (
  {
    owner = {},
    profile = {},
    clients = [],
    archivedClients = [],
    services = [],
    archivedServices = [],
    barbers = [],
    archivedBarbers = [],
    appointments = [],
    auditLogs = [],
  } = {},
  { generatedAt = new Date() } = {}
) => {
  const data = {
    profile,
    clients,
    archivedClients,
    services,
    archivedServices,
    barbers,
    archivedBarbers,
    appointments,
    auditLogs,
  };

  return toExportValue({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    product: "BarberOS",
    generatedAt,
    manifest: {
      purpose: "workspace_backup",
      privacyNotice: EXPORT_PRIVACY_NOTICE,
      containsPersonalData: true,
      collections: Object.keys(data),
    },
    owner: {
      uid: owner.uid || "",
      email: owner.email || "",
      workspaceName: profile.barbershopName || profile.displayName || "",
    },
    counts: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value.length : 1])
    ),
    data,
  });
};

export const createWorkspaceExportFilename = (profile = {}, generatedAt = new Date()) => {
  const sourceName = profile.slug || profile.barbershopName || "barberos";
  const safeName = String(sourceName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "barberos";
  const date = generatedAt.toISOString().slice(0, 10);

  return `${safeName}-export-${date}.json`;
};
