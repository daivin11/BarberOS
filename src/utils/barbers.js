import { isValidPublicUrl } from "./profileValidation.js";

export const BARBER_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  specialtyMax: 80,
  avatarMax: 500,
};

export const normalizeBarberInput = ({ name = "", specialty = "", avatar = "" } = {}) => ({
  name: String(name).trim(),
  specialty: String(specialty).trim(),
  avatar: String(avatar).trim(),
});

export const validateBarberInput = ({ name = "", specialty = "", avatar = "" } = {}) => {
  const cleanName = String(name).trim();
  const cleanSpecialty = String(specialty).trim();
  const cleanAvatar = String(avatar).trim();

  if (cleanName.length < BARBER_LIMITS.nameMin) {
    return `Nome do barbeiro precisa ter pelo menos ${BARBER_LIMITS.nameMin} caracteres.`;
  }

  if (cleanName.length > BARBER_LIMITS.nameMax) {
    return `Nome do barbeiro deve ter no maximo ${BARBER_LIMITS.nameMax} caracteres.`;
  }

  if (cleanSpecialty.length > BARBER_LIMITS.specialtyMax) {
    return `Especialidade deve ter no maximo ${BARBER_LIMITS.specialtyMax} caracteres.`;
  }

  if (cleanAvatar.length > BARBER_LIMITS.avatarMax || !isValidPublicUrl(cleanAvatar)) {
    return "Avatar precisa ser uma URL http ou https valida.";
  }

  return "";
};