import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SERVICE_LIMITS,
  normalizeServiceInput,
  validateServiceInput,
} from "../src/utils/services.js";

describe("service utils", () => {
  it("normalizes service input for persistence", () => {
    assert.deepEqual(
      normalizeServiceInput({ name: " Corte ", price: "45", duration: "30" }),
      { name: "Corte", price: 45, duration: 30 }
    );
  });

  it("accepts valid service input", () => {
    assert.equal(validateServiceInput({ name: "Corte", price: 45, duration: 30 }), "");
  });

  it("rejects unsafe service price and duration", () => {
    assert.match(validateServiceInput({ name: "Corte", price: SERVICE_LIMITS.priceMax + 1, duration: 30 }), /Preco/);
    assert.match(validateServiceInput({ name: "Corte", price: 45, duration: 10 }), /Duracao/);
  });
});
