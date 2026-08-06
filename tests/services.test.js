import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SERVICE_LIMITS,
  findDuplicateServiceByName,
  getServiceCatalogDuration,
  getServiceCatalogPrice,
  normalizeServiceInput,
  normalizeServiceNameKey,
  validateServiceInput,
} from "../src/utils/services.js";

describe("service utils", () => {
  it("normalizes service input for persistence", () => {
    assert.deepEqual(
      normalizeServiceInput({ name: "  Corte   Masculino  ", price: "45", duration: "30" }),
      { name: "Corte Masculino", price: 45, duration: 30 }
    );
    assert.equal(normalizeServiceNameKey("  Corte   Masculino  "), "corte masculino");
  });

  it("accepts valid service input", () => {
    assert.equal(validateServiceInput({ name: "Corte", price: 45, duration: 30 }), "");
  });

  it("rejects unsafe service price and duration", () => {
    assert.match(validateServiceInput({ name: "Corte", price: SERVICE_LIMITS.priceMax + 1, duration: 30 }), /Preco/);
    assert.match(validateServiceInput({ name: "Corte", price: 45, duration: 10 }), /Duracao/);
    assert.match(validateServiceInput({ name: "Corte", price: 45, duration: "abc" }), /Duracao/);
    assert.match(validateServiceInput({ name: "Corte", price: 45, duration: 30.5 }), /Duracao/);
    assert.match(validateServiceInput({ name: "Corte", price: 45, duration: 20 }), /Duracao/);
  });

  it("returns a safe catalog price for legacy services", () => {
    assert.equal(getServiceCatalogPrice({ price: "45" }), 45);
    assert.equal(getServiceCatalogPrice({ price: "aberto" }), 0);
    assert.equal(getServiceCatalogPrice({ price: -20 }), 0);
  });

  it("returns a safe catalog duration for legacy services", () => {
    assert.equal(getServiceCatalogDuration({ duration: "45" }), 45);
    assert.equal(getServiceCatalogDuration({ duration: "bad" }), 30);
    assert.equal(getServiceCatalogDuration({ duration: 30.5 }), 30);
    assert.equal(getServiceCatalogDuration({ duration: 20 }), 30);
    assert.equal(getServiceCatalogDuration({ duration: 240 }), 240);
  });

  it("finds duplicate active services by normalized name", () => {
    const services = [
      { id: "1", name: "Corte Masculino" },
      { id: "2", name: "Barba", isArchived: true },
    ];

    assert.equal(findDuplicateServiceByName(services, " corte masculino ")?.id, "1");
    assert.equal(findDuplicateServiceByName(services, "CORTE MASCULINO", "1"), null);
    assert.equal(findDuplicateServiceByName(services, "barba"), null);
  });
});
