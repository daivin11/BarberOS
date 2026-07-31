import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createRenewalRequestId,
  createRenewalRequestPayload,
  getBillingStatusLabel,
  getBlockedAccountContent,
  getPlanLabel,
  getRenewalRequestPlan,
  getRenewalRequestStatus,
} from "../src/utils/billing.js";

describe("billing utils", () => {
  it("returns stable plan and status labels", () => {
    assert.equal(getPlanLabel("trial"), "Trial");
    assert.equal(getPlanLabel("studio"), "Studio");
    assert.equal(getPlanLabel("custom"), "custom");
    assert.equal(getBillingStatusLabel("past_due"), "Pagamento pendente");
  });

  it("returns specific blocked copy for payment issues", () => {
    const pastDue = getBlockedAccountContent({ status: "past_due" });
    const cancelled = getBlockedAccountContent({ status: "cancelled" });
    const expired = getBlockedAccountContent({ status: "trial_expired" });

    assert.match(pastDue.title, /pendencia/);
    assert.match(cancelled.actionLabel, /reativacao/);
    assert.match(expired.actionLabel, /renovacao/);
  });

  it("creates the renewal request payload allowed by Firestore rules", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");
    const payload = createRenewalRequestPayload({
      userId: "user-1",
      profile: { barbershopName: "BarberOS Studio" },
      accountAccess: { status: "trial_expired", plan: "trial" },
      now,
    });

    assert.deepEqual(Object.keys(payload).sort(), [
      "accountStatus",
      "barbershopName",
      "createdAt",
      "plan",
      "status",
      "timestamp",
      "userId",
    ]);
    assert.equal(payload.userId, "user-1");
    assert.equal(payload.barbershopName, "BarberOS Studio");
    assert.equal(payload.status, "pending");
    assert.equal(payload.createdAt, now);
  });

  it("creates a deterministic renewal request document id", () => {
    assert.equal(createRenewalRequestId("user-1"), "user-1");
    assert.equal(createRenewalRequestId("owner/1"), "owner_1");
  });

  it("sanitizes renewal status and plan to values accepted by rules", () => {
    assert.equal(getRenewalRequestStatus("past_due"), "past_due");
    assert.equal(getRenewalRequestStatus("active"), "trial_expired");
    assert.equal(getRenewalRequestPlan("studio"), "studio");
    assert.equal(getRenewalRequestPlan("enterprise"), "trial");
  });
});
