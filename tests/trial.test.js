import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTrialEndDate,
  getAccountAccess,
  getTrialDaysRemaining,
  isAccountActive,
  isSubscriptionActive,
  isTrialActive,
  TRIAL_DAYS,
} from "../src/utils/trial.js";

describe("trial utils", () => {
  it("creates a 30 day trial window", () => {
    const start = new Date("2026-07-01T12:00:00.000Z");
    const end = createTrialEndDate(start);

    assert.equal(TRIAL_DAYS, 30);
    assert.equal(end.toISOString(), "2026-07-31T12:00:00.000Z");
  });

  it("calculates remaining days with ceiling semantics", () => {
    const profile = { trialEndsAt: new Date("2026-07-31T12:00:00.000Z") };

    assert.equal(getTrialDaysRemaining(profile, new Date("2026-07-30T13:00:00.000Z")), 1);
    assert.equal(getTrialDaysRemaining(profile, new Date("2026-08-01T12:00:00.000Z")), 0);
  });

  it("keeps legacy profiles without trial end active", () => {
    assert.equal(isTrialActive({}, new Date("2026-08-01T12:00:00.000Z")), true);
  });

  it("detects expired trials", () => {
    const profile = { trialEndsAt: new Date("2026-07-31T12:00:00.000Z") };

    assert.equal(isTrialActive(profile, new Date("2026-07-31T11:59:59.000Z")), true);
    assert.equal(isTrialActive(profile, new Date("2026-07-31T12:00:00.000Z")), false);
  });

  it("keeps paid accounts active after trial ends", () => {
    const profile = {
      plan: "studio",
      subscriptionStatus: "active",
      trialEndsAt: new Date("2026-07-31T12:00:00.000Z"),
      subscriptionEndsAt: new Date("2026-09-01T12:00:00.000Z"),
    };

    assert.equal(isSubscriptionActive(profile, new Date("2026-08-15T12:00:00.000Z")), true);
    assert.equal(isAccountActive(profile, new Date("2026-08-15T12:00:00.000Z")), true);
    assert.deepEqual(getAccountAccess(profile, new Date("2026-08-15T12:00:00.000Z")).status, "active");
  });

  it("blocks active subscriptions after their end date", () => {
    const profile = {
      plan: "studio",
      subscriptionStatus: "active",
      trialEndsAt: new Date("2026-07-31T12:00:00.000Z"),
      subscriptionEndsAt: new Date("2026-08-01T12:00:00.000Z"),
    };

    assert.equal(isSubscriptionActive(profile, new Date("2026-08-01T12:00:00.000Z")), false);
    assert.equal(isAccountActive(profile, new Date("2026-08-01T12:00:00.000Z")), false);
  });

  it("surfaces past due accounts distinctly", () => {
    const profile = {
      plan: "studio",
      subscriptionStatus: "past_due",
      trialEndsAt: new Date("2026-07-31T12:00:00.000Z"),
    };

    const access = getAccountAccess(profile, new Date("2026-08-01T12:00:00.000Z"));

    assert.equal(access.active, false);
    assert.equal(access.status, "past_due");
    assert.equal(access.label, "Pagamento pendente");
  });
});
