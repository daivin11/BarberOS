const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateLoginForm = ({ email = "", password = "" } = {}) => {
  const cleanEmail = String(email).trim();

  if (!cleanEmail || !emailPattern.test(cleanEmail)) {
    return "Informe um e-mail valido.";
  }

  if (!password) {
    return "Informe sua senha.";
  }

  return "";
};

export const validateRegisterForm = ({
  email = "",
  password = "",
  confirmPassword = "",
} = {}) => {
  const loginError = validateLoginForm({ email, password });

  if (loginError) {
    return loginError;
  }

  if (password.length < 6) {
    return "Use uma senha com pelo menos 6 caracteres.";
  }

  if (password !== confirmPassword) {
    return "As senhas nao coincidem.";
  }

  return "";
};

