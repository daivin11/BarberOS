export const copyTextToClipboard = async (text, clipboardApi) => {
  const value = String(text || "");
  const api =
    clipboardApi ||
    (typeof navigator !== "undefined" && navigator.clipboard ? navigator.clipboard : null);

  if (!value || typeof api?.writeText !== "function") return false;

  try {
    await api.writeText(value);
    return true;
  } catch {
    return false;
  }
};
