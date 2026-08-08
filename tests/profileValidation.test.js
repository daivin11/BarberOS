import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROFILE_LIMITS,
  isValidPublicUrl,
  normalizeSlug,
  validatePublicProfileInput,
} from "../src/utils/profileValidation.js";

describe("profile validation", () => {
  it("normalizes public slugs", () => {
    assert.equal(normalizeSlug(" Barbearia Central!!! "), "barbearia-central");
  });

  it("accepts valid public profile input", () => {
    assert.equal(
      validatePublicProfileInput({
        barbershopName: "Barbearia Central",
        slug: "barbearia-central",
        phone: "(11) 98888-7777",
        bio: "Cortes classicos e modernos.",
        logoUrl: "https://example.com/logo.png",
      }),
      ""
    );
  });

  it("rejects oversized public profile fields", () => {
    assert.match(
      validatePublicProfileInput({
        barbershopName: "A".repeat(PROFILE_LIMITS.nameMax + 1),
        slug: "barbearia",
        phone: "(11) 98888-7777",
      }),
      /Nome/
    );
  });

  it("rejects unsafe logo URLs", () => {
    assert.equal(isValidPublicUrl("javascript:alert(1)"), false);
    assert.equal(isValidPublicUrl("http://example.com/logo.png"), false);
    assert.equal(isValidPublicUrl("https://example.com/logo.png"), true);
    assert.match(
      validatePublicProfileInput({
        barbershopName: "Barbearia",
        slug: "barbearia",
        phone: "(11) 98888-7777",
        logoUrl: "ftp://example.com/logo.png",
      }),
      /URL/
    );
  });
});
