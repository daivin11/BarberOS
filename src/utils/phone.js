export const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

export const isValidBrazilianPhone = (value) => {
  const phone = normalizePhone(value);
  return phone.length >= 10 && phone.length <= 13;
};

export const formatBrazilianPhone = (value) => {
  const phone = normalizePhone(value);
  if (phone.length <= 2) return phone;

  const localPhone = phone.startsWith("55") && phone.length > 11 ? phone.slice(2) : phone;

  if (localPhone.length <= 10) {
    return localPhone
      .replace(/^(\d{2})(\d{0,4})(\d{0,4}).*/, (_, ddd, first, second) =>
        [first ? `(${ddd}) ${first}` : `(${ddd})`, second ? `-${second}` : ""].join("")
      )
      .trim();
  }

  return localPhone
    .replace(/^(\d{2})(\d{0,5})(\d{0,4}).*/, (_, ddd, first, second) =>
      [first ? `(${ddd}) ${first}` : `(${ddd})`, second ? `-${second}` : ""].join("")
    )
    .trim();
};

export const getWhatsAppPhone = (value) => {
  const phone = normalizePhone(value);
  if (!phone) return "";
  if (phone.startsWith("55") && phone.length >= 12) return phone;
  if (phone.length === 10 || phone.length === 11) return `55${phone}`;
  return phone;
};

export const createWhatsAppUrl = ({ phone = "", message = "" } = {}) => {
  const whatsappPhone = getWhatsAppPhone(phone);
  const encodedMessage = encodeURIComponent(String(message || ""));

  if (whatsappPhone) {
    return encodedMessage
      ? `https://wa.me/${whatsappPhone}?text=${encodedMessage}`
      : `https://wa.me/${whatsappPhone}`;
  }

  return encodedMessage ? `https://wa.me/?text=${encodedMessage}` : "https://wa.me/";
};
