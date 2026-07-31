import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPOINTMENT_WINDOW_LIMITS,
  createAppointmentDateWindow,
  getAppointmentWindowLabel,
  getAppointmentWindowMonthBounds,
  isDateWithinAppointmentWindow,
  isMonthWithinAppointmentWindow,
} from "../src/utils/appointmentWindow.js";

describe("appointment window utils", () => {
  it("creates the default operational appointment window", () => {
    assert.deepEqual(createAppointmentDateWindow({ today: "2026-07-30" }), {
      startDate: "2025-07-30",
      endDate: "2027-01-26",
    });
  });

  it("does not allow negative custom spans", () => {
    assert.deepEqual(
      createAppointmentDateWindow({ today: "2026-07-30", pastDays: -10, futureDays: -5 }),
      {
        startDate: "2026-07-30",
        endDate: "2026-07-30",
      }
    );
  });

  it("checks whether a date fits inside an appointment window", () => {
    const window = { startDate: "2026-01-01", endDate: "2026-12-31" };

    assert.equal(isDateWithinAppointmentWindow("2026-07-30", window), true);
    assert.equal(isDateWithinAppointmentWindow("2025-12-31", window), false);
    assert.equal(isDateWithinAppointmentWindow("2027-01-01", window), false);
  });


  it("checks month bounds for financial views", () => {
    const window = { startDate: "2026-01-15", endDate: "2026-12-20" };

    assert.deepEqual(getAppointmentWindowMonthBounds(window), {
      startMonth: "2026-01",
      endMonth: "2026-12",
    });
    assert.equal(isMonthWithinAppointmentWindow("2026-01", window), true);
    assert.equal(isMonthWithinAppointmentWindow("2026-12", window), true);
    assert.equal(isMonthWithinAppointmentWindow("2025-12", window), false);
    assert.equal(isMonthWithinAppointmentWindow("2027-01", window), false);
  });
  it("documents the current default window size", () => {
    assert.equal(APPOINTMENT_WINDOW_LIMITS.pastDays, 365);
    assert.equal(APPOINTMENT_WINDOW_LIMITS.futureDays, 180);
    assert.equal(
      getAppointmentWindowLabel({ startDate: "2025-07-30", endDate: "2027-01-26" }),
      "Agendamentos carregados de 2025-07-30 ate 2027-01-26."
    );
  });
});