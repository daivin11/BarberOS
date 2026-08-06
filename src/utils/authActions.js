const DEFAULT_AUTH_CONTINUE_PATH = "/login";

const normalizeContinuePath = (path) => {
  const value = String(path || DEFAULT_AUTH_CONTINUE_PATH).trim();
  if (!value || value.startsWith("http://") || value.startsWith("https://")) {
    return DEFAULT_AUTH_CONTINUE_PATH;
  }
  return value.startsWith("/") ? value : `/${value}`;
};

const getConfiguredActionUrl = () => {
  if (typeof import.meta === "undefined") return "";
  return import.meta.env?.VITE_AUTH_ACTION_URL || "";
};

const getSafeBaseUrl = (...candidates) => {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;

    try {
      const url = new URL(value);
      if (["http:", "https:"].includes(url.protocol)) return url.origin;
    } catch {
      // Ignore invalid configured origins and try the next candidate.
    }
  }

  return "";
};

export const getPasswordResetActionCodeSettings = ({
  origin,
  continuePath = DEFAULT_AUTH_CONTINUE_PATH,
  configuredActionUrl = getConfiguredActionUrl(),
} = {}) => {
  const baseUrl = getSafeBaseUrl(configuredActionUrl, origin);
  const normalizedPath = normalizeContinuePath(continuePath);

  try {
    const url = new URL(normalizedPath, baseUrl);
    return {
      url: url.toString(),
      handleCodeInApp: false,
    };
  } catch {
    return {
      url: normalizedPath,
      handleCodeInApp: false,
    };
  }
};
