import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPOINTMENT_STATUS,
  countActiveAppointmentsByField,
  countAppointmentsByStatus,
  getAppointmentStatus,
  getAppointmentStatusClass,
  getAppointmentStatusLabel,
  isActiveAppointment,
  isCancelledAppointment,
  isCompletedAppointment,
  isTerminalAppointment,
} from "../src/utils/appointments.js";

describe("appointment utils", () => {
  it("defaults missing status to pending", () => {
    assert.equal(getAppointmentStatus({}), APPOINTMENT_STATUS.pending);
    assert.equal(isActiveAppointment({}), true);
  });

  it("classifies active, completed and cancelled statuses", () => {
    assert.equal(isActiveAppointment({ status: "confirmed" }), true);
    assert.equal(isActiveAppointment({ status: "completed" }), false);
    assert.equal(isCompletedAppointment({ status: "completed" }), true);
    assert.equal(isCancelledAppointment({ status: "cancelled" }), true);
    assert.equal(isTerminalAppointment({ status: "completed" }), true);
    assert.equal(isTerminalAppointment({ status: "cancelled" }), true);
    assert.equal(isTerminalAppointment({ status: "pending" }), false);
  });

  it("returns stable labels and visual classes", () => {
    assert.equal(getAppointmentStatusLabel("confirmed"), "Confirmado");
    assert.equal(getAppointmentStatusLabel("unknown"), "unknown");
    assert.match(getAppointmentStatusClass("cancelled"), /red/);
  });

  it("counts appointments by normalized status", () => {
    assert.deepEqual(
      countAppointmentsByStatus([
        {},
        { status: "confirmed" },
        { status: "completed" },
        { status: "cancelled" },
        { status: "confirmed" },
      ]),
      {
        pending: 1,
        confirmed: 2,
        completed: 1,
        cancelled: 1,
      }
    );
  });

  it("counts active appointments grouped by field", () => {
    assert.deepEqual(
      countActiveAppointmentsByField(
        [
          { barberId: "a" },
          { barberId: "a", status: "confirmed" },
          { barberId: "a", status: "completed" },
          { barberId: "b", status: "pending" },
          { status: "pending" },
        ],
        "barberId"
      ),
      { a: 2, b: 1 }
    );
  });
});
