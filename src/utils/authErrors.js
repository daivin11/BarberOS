export const getFriendlyAuthError = (error, fallback = "Nao foi possivel concluir a acao. Tente novamente.") => {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "Este e-mail ja esta cadastrado. Tente entrar ou redefinir a senha.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha invalidos.";
    case "auth/invalid-email":
      return "Informe um e-mail valido.";
    case "auth/weak-password":
      return "Use uma senha com pelo menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
    case "auth/network-request-failed":
      return "Falha de conexao. Verifique sua internet e tente novamente.";
    default:
      return fallback;
  }
};
