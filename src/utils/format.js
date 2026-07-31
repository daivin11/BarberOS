export const formatCurrencyBRL = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);

export const formatDuration = (minutes) => {
  const value = Number(minutes) || 0;
  return `${value} ${value === 1 ? "minuto" : "minutos"}`;
};

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${Number(count) === 1 ? singular : plural}`;
