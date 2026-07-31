import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BARBER_LIMITS,
  normalizeBarberInput,
  validateBarberInput,
} from "../src/utils/barbers.js";

describe("barber utils", () => {
  it("normalizes barber input for persistence", () => {
    assert.deepEqual(
      normalizeBarberInput({ name: " Gabriel ", specialty: " Corte e barba ", avatar: " https://example.com/a.png " }),
      { name: "Gabriel", specialty: "Corte e barba", avatar: "https://example.com/a.png" }
    );
  });

  it("accepts valid barber input", () => {
    assert.equal(validateBarberInput({ name: "Gabriel", specialty: "Corte", avatar: "https://example.com/a.png" }), "");
    assert.equal(validateBarberInput({ name: "Gabriel", specialty: "", avatar: "" }), "");
  });

  it("rejects unsafe barber data", () => {
    assert.match(validateBarberInput({ name: "G" }), /pelo menos/);
    assert.match(validateBarberInput({ name: "A".repeat(BARBER_LIMITS.nameMax + 1) }), /maximo/);
    assert.match(validateBarberInput({ name: "Gabriel", specialty: "A".repeat(BARBER_LIMITS.specialtyMax + 1) }), /Especialidade/);
    assert.match(validateBarberInput({ name: "Gabriel", avatar: "javascript:alert(1)" }), /Avatar/);
  });
});