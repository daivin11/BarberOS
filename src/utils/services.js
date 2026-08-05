export const SERVICE_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  priceMin: 0,
  priceMax: 100000,
  durationMin: 15,
  durationMax: 240,
};

export const normalizeServiceInput = ({ name, price, duration }) => ({
  name: String(name || "").trim(),
  price: Number(price),
  duration: Number(duration) || 30,
});

export const normalizeServiceNameKey = (name = "") =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const findDuplicateServiceByName = (services = [], name = "", ignoredServiceId = "") => {
  const nameKey = normalizeServiceNameKey(name);
  if (!nameKey) return null;

  return (
    services.find(
      (service) =>
        String(service.id || "") !== String(ignoredServiceId || "") &&
        !service.isArchived &&
        normalizeServiceNameKey(service.name) === nameKey
    ) || null
  );
};

export const validateServiceInput = ({ name, price, duration }) => {
  const service = normalizeServiceInput({ name, price, duration });

  if (service.name.length < SERVICE_LIMITS.nameMin || service.name.length > SERVICE_LIMITS.nameMax) {
    return "Nome do servico deve ter entre 2 e 80 caracteres.";
  }

  if (
    !Number.isFinite(service.price) ||
    service.price < SERVICE_LIMITS.priceMin ||
    service.price > SERVICE_LIMITS.priceMax
  ) {
    return "Preco do servico deve ficar entre R$ 0,00 e R$ 100.000,00.";
  }

  if (
    !Number.isFinite(service.duration) ||
    service.duration < SERVICE_LIMITS.durationMin ||
    service.duration > SERVICE_LIMITS.durationMax
  ) {
    return "Duracao do servico precisa ficar entre 15 e 240 minutos.";
  }

  return "";
};
