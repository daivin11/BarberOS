export const PROFILE_LIMITS = {
  nameMax: 80,
  slugMin: 3,
  slugMax: 60,
  phoneMin: 10,
  phoneMax: 20,
  bioMax: 500,
  urlMax: 500,
};

export const normalizeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/(^-|-$)/g, "");

export const isValidPublicUrl = (value) => {
  if (!value) return true;
  if (value.length > PROFILE_LIMITS.urlMax) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

export const validatePublicProfileInput = ({
  barbershopName = "",
  slug = "",
  phone = "",
  bio = "",
  logoUrl = "",
} = {}) => {
  const cleanName = String(barbershopName).trim();
  const cleanSlug = normalizeSlug(slug);
  const cleanPhone = String(phone).trim();
  const cleanBio = String(bio).trim();
  const cleanLogoUrl = String(logoUrl).trim();

  if (!cleanName || !cleanSlug || !cleanPhone) {
    return "Preencha nome da barbearia, slug e telefone.";
  }

  if (cleanName.length > PROFILE_LIMITS.nameMax) {
    return `Nome da barbearia deve ter no maximo ${PROFILE_LIMITS.nameMax} caracteres.`;
  }

  if (cleanSlug.length < PROFILE_LIMITS.slugMin || cleanSlug.length > PROFILE_LIMITS.slugMax) {
    return `Slug publico deve ter entre ${PROFILE_LIMITS.slugMin} e ${PROFILE_LIMITS.slugMax} caracteres.`;
  }

  if (cleanPhone.length < PROFILE_LIMITS.phoneMin || cleanPhone.length > PROFILE_LIMITS.phoneMax) {
    return `Telefone deve ter entre ${PROFILE_LIMITS.phoneMin} e ${PROFILE_LIMITS.phoneMax} caracteres.`;
  }

  if (cleanBio.length > PROFILE_LIMITS.bioMax) {
    return `Bio deve ter no maximo ${PROFILE_LIMITS.bioMax} caracteres.`;
  }

  if (!isValidPublicUrl(cleanLogoUrl)) {
    return "Logo precisa ser uma URL HTTPS valida.";
  }

  return "";
};
