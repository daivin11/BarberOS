import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getActivationState } from "../src/utils/onboarding.js";

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
});
