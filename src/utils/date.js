export const formatLocalDate = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return formatLocalDate(new Date());

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (date) => {
  if (!date) return new Date();
  const [year, month, day] = String(date).split("-").map(Number);
  if (!year || !month || !day) return new Date();

  return new Date(year, (month || 1) - 1, day || 1);
};

export const formatDateBR = (date) =>
  parseLocalDate(date).toLocaleDateString("pt-BR");

export const addLocalDays = (date, days) => {
  const nextDate = parseLocalDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return formatLocalDate(nextDate);
};
