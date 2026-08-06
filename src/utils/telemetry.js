const env = import.meta.env || {};
const enabled = env.VITE_ENABLE_CLIENT_LOGS === "true";
const endpoint = env.VITE_TELEMETRY_ENDPOINT || "";

export const sanitizeTelemetryText = (value, fallback = "") => {
  const text = String(value || fallback);

  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
};

const safeErrorCode = (error) =>
  typeof error?.code === "string" ? error.code.slice(0, 80) : undefined;

const safeErrorMessage = (error) =>
  typeof error?.message === "string"
    ? sanitizeTelemetryText(error.message).slice(0, 160)
    : "Unknown error";

const sanitizeProperties = (properties = {}) => {
  const allowed = {};
  const allowList = ["source", "action", "route", "code", "status", "step"];

  allowList.forEach((key) => {
    const value = properties[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      allowed[key] = sanitizeTelemetryText(value).slice(0, 80);
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
