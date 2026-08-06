import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getActivationState, getPublicBookingReadiness } from "../src/utils/onboarding.js";

describe("onboarding utils", () => {
  it("starts with profile as the first activation step", () => {
    const state = getActivationState();

    assert.equal(state.completedCount, 0);
    assert.equal(state.progress, 0);
    assert.equal(state.nextItem.id, "profile");
  });

  it("moves next step after profile and hours are complete", () => {
    const state = getActivationState({
      profile: {
        profileComplete: true,
        slug: "barbearia-central",
        barbershopName: "Barbearia Central",
        businessHours: { start: "09:00", end: "18:00" },
      },
    });

    assert.equal(state.completedCount, 2);
    assert.equal(state.nextItem.id, "services");
  });

  it("marks account activated when all operational steps are done", () => {
    const state = getActivationState({
      profile: {
        profileComplete: true,
        slug: "barbearia-central",
        barbershopName: "Barbearia Central",
        businessHours: { start: "09:00", end: "18:00" },
      },
      servicesCount: 1,
      barbersCount: 1,
      clientsCount: 1,
      appointmentsCount: 1,
    });

    assert.equal(state.isActivated, true);
    assert.equal(state.progress, 100);
    assert.equal(state.nextItem, null);
  });

  it("blocks public link sharing until profile, hours, services and barbers are ready", () => {
    const readiness = getPublicBookingReadiness({
      profile: {
        profileComplete: true,
        slug: "barbearia-central",
        barbershopName: "Barbearia Central",
        businessHours: { start: "09:00", end: "18:00" },
      },
      servicesCount: 1,
      barbersCount: 0,
    });

    assert.equal(readiness.isReady, false);
    assert.deepEqual(readiness.missing.map((item) => item.id), ["barbers"]);
    assert.equal(readiness.nextStep.to, "/barbeiros?setup=barbers");
  });

  it("marks the public booking link ready with the operational minimum", () => {
    const readiness = getPublicBookingReadiness({
      profile: {
        profileComplete: true,
        slug: "barbearia-central",
        barbershopName: "Barbearia Central",
        businessHours: { start: "09:00", end: "18:00" },
      },
      servicesCount: 1,
      barbersCount: 1,
    });

    assert.equal(readiness.isReady, true);
    assert.equal(readiness.nextStep, null);
  });

  it("blocks public link sharing for inactive accounts", () => {
    const readiness = getPublicBookingReadiness({
      profile: {
        profileComplete: true,
        slug: "barbearia-central",
        barbershopName: "Barbearia Central",
        businessHours: { start: "09:00", end: "18:00" },
        subscriptionStatus: "past_due",
        trialEndsAt: new Date("2026-07-01T12:00:00.000Z"),
      },
      servicesCount: 1,
      barbersCount: 1,
    });

    assert.equal(readiness.isReady, false);
    assert.equal(readiness.nextStep.id, "account");
  });
});
