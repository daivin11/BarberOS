import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeTelemetryText } from "../src/utils/telemetry.js";

describe("telemetry utils", () => {
  it("redacts personal data from telemetry text", () => {
    const sanitized = sanitizeTelemetryText(
      "Falha para david@example.com no telefone +55 (11) 98888-7777 em https://barberos.app/david"
    );

    assert.equal(
      sanitized,
      "Falha para [email] no telefone [phone] em [url]"
    );
  });
});
