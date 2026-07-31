import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPasswordResetActionCodeSettings } from "../src/utils/authActions.js";

describe("auth action settings", () => {
  it("builds password reset continue URL from the current origin", () => {
    assert.deepEqual(
      getPasswordResetActionCodeSettings({
        origin: "https://barberos.app",
      }),
      {
        url: "https://barberos.app/login",
        handleCodeInApp: false,
      }
    );
  });

  it("uses configured action URL when provided", () => {
    assert.equal(
      getPasswordResetActionCodeSettings({
        origin: "https://preview.local",
        configuredActionUrl: "https://app.barberos.com.br",
        continuePath: "/login?reset=1",
      }).url,
      "https://app.barberos.com.br/login?reset=1"
    );
  });

  it("does not accept an absolute continue path", () => {
    assert.equal(
      getPasswordResetActionCodeSettings({
        origin: "https://barberos.app",
        continuePath: "https://evil.example/reset",
      }).url,
      "https://barberos.app/login"
    );
  });
});
