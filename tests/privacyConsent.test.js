import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRIVACY_CONSENT_VERSION,
  createPrivacyConsentSnapshot,
  isPrivacyConsentAccepted,
} from "../src/utils/privacyConsent.js";

describe("privacy consent utils", () => {
  it("creates a versioned privacy consent snapshot", () => {
    const acceptedAt = new Date("2026-08-05T12:00:00.000Z");
    const snapshot = createPrivacyConsentSnapshot({ accepted: true, acceptedAt });

    assert.equal(snapshot.privacyConsent, true);
    assert.equal(snapshot.privacyConsentVersion, PRIVACY_CONSENT_VERSION);
    assert.equal(snapshot.privacyConsentAt, acceptedAt);
  });

  it("only treats explicit true as accepted", () => {
    assert.equal(isPrivacyConsentAccepted(true), true);
    assert.equal(isPrivacyConsentAccepted("true"), false);
    assert.equal(isPrivacyConsentAccepted(false), false);
  });
});
