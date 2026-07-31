const enabled = import.meta.env.VITE_ENABLE_CLIENT_LOGS === "true";
const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT || "";

const safeErrorCode = (error) =>
  typeof error?.code === "string" ? error.code.slice(0, 80) : undefined;

const safeErrorMessage = (error) =>
  typeof error?.message === "string" ? error.message.slice(0, 160) : "Unknown error";

const sanitizeProperties = (properties = {}) => {
  const allowed = {};
  const allowList = ["source", "action", "route", "code", "status", "step"];

  allowList.forEach((key) => {
    const value = properties[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      allowed[key] = String(value).slice(0, 80);
    }
  });

  return allowed;
};

const sendTelemetry = (payload) => {
  if (!enabled) return;

  if (!endpoint) {
    console.info("[telemetry]", payload);
    return;
  }

  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry must never break the user flow.
  }
};

export const trackEvent = (name, properties = {}) => {
  sendTelemetry({
    type: "event",
    name: String(name || "unknown").slice(0, 80),
    properties: sanitizeProperties(properties),
    timestamp: new Date().toISOString(),
  });
};

export const reportError = (error, properties = {}) => {
  sendTelemetry({
    type: "error",
    message: safeErrorMessage(error),
    code: safeErrorCode(error),
    properties: sanitizeProperties(properties),
    timestamp: new Date().toISOString(),
  });
};
