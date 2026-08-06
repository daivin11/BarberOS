import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateLoginForm, validateRegisterForm } from "../src/utils/authForms.js";

describe("auth form validation", () => {
  it("validates login fields before reaching Firebase", () => {
    assert.equal(validateLoginForm({ email: "invalid", password: "secret" }), "Informe um e-mail valido.");
    assert.equal(validateLoginForm({ email: "owner@barberos.app", password: "" }), "Informe sua senha.");
    assert.equal(validateLoginForm({ email: " owner@barberos.app ", password: "secret" }), "");
  });

  it("validates register fields before creating an account", () => {
    assert.equal(
      validateRegisterForm({
        email: "owner@barberos.app",
        password: "123",
        confirmPassword: "123",
      }),
      "Use uma senha com pelo menos 6 caracteres."
    );
    assert.equal(
      validateRegisterForm({
        email: "owner@barberos.app",
        password: "123456",
        confirmPassword: "654321",
      }),
      "As senhas nao coincidem."
    );
    assert.equal(
      validateRegisterForm({
        email: "owner@barberos.app",
        password: "123456",
        confirmPassword: "123456",
      }),
      ""
    );
  });
});
