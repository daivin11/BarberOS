import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWhatsAppUrl,
  formatBrazilianPhone,
  getWhatsAppPhone,
  isValidBrazilianPhone,
  normalizePhone,
} from "../src/utils/phone.js";

describe("phone utils", () => {
  it("normalizes phone input to digits only", () => {
    assert.equal(normalizePhone("+55 (11) 98888-7777"), "5511988887777");
    assert.equal(normalizePhone(null), "");
  });

  it("validates Brazilian phone lengths accepted by Firestore rules", () => {
    assert.equal(isValidBrazilianPhone("(11) 98888-7777"), true);
    assert.equal(isValidBrazilianPhone("+55 11 98888-7777"), true);
    assert.equal(isValidBrazilianPhone("123456789"), false);
    assert.equal(isValidBrazilianPhone("12345678901234"), false);
  });

  it("formats local and country-code Brazilian phones for display", () => {
    assert.equal(formatBrazilianPhone("11988887777"), "(11) 98888-7777");
    assert.equal(formatBrazilianPhone("5511988887777"), "(11) 98888-7777");
    assert.equal(formatBrazilianPhone("1133334444"), "(11) 3333-4444");
  });

  it("builds WhatsApp phone numbers without double country code", () => {
    assert.equal(getWhatsAppPhone("11988887777"), "5511988887777");
    assert.equal(getWhatsAppPhone("+55 (11) 98888-7777"), "5511988887777");
  });

  it("creates WhatsApp links for a phone or generic share message", () => {
    assert.equal(
      createWhatsAppUrl({ phone: "(11) 98888-7777", message: "Ola teste" }),
      "https://wa.me/5511988887777?text=Ola%20teste"
    );
    assert.equal(createWhatsAppUrl({ message: "Ola" }), "https://wa.me/?text=Ola");
  });
});
