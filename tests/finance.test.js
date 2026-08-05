import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APPOINTMENT_STATUS } from "../src/utils/appointments.js";
import {
  calculateFinanceMetrics,
  formatPercentage,
  getServicePrice,
  getUpcomingRevenueAppointments,
} from "../src/utils/finance.js";

const appointment = ({ status, price, date = "2026-08-05", time = "10:00" }) => ({
  status,
  date,
  time,
  service: { price },
});

describe("finance utils", () => {
  it("calculates realized, projected, pending and lost revenue", () => {
    const metrics = calculateFinanceMetrics([
      appointment({ status: APPOINTMENT_STATUS.completed, price: 50 }),
      appointment({ status: APPOINTMENT_STATUS.confirmed, price: 40 }),
      appointment({ status: APPOINTMENT_STATUS.pending, price: 30 }),
      appointment({ status: APPOINTMENT_STATUS.cancelled, price: 20 }),
    ]);

    assert.equal(metrics.realizedRevenue, 50);
    assert.equal(metrics.projectedRevenue, 70);
    assert.equal(metrics.confirmedRevenue, 40);
    assert.equal(metrics.pendingRevenue, 30);
    assert.equal(metrics.lostRevenue, 20);
    assert.equal(metrics.averageTicket, 50);
  });

  it("calculates operational conversion rates", () => {
    const metrics = calculateFinanceMetrics([
      appointment({ status: APPOINTMENT_STATUS.completed, price: 50 }),
      appointment({ status: APPOINTMENT_STATUS.confirmed, price: 40 }),
      appointment({ status: APPOINTMENT_STATUS.pending, price: 30 }),
      appointment({ status: APPOINTMENT_STATUS.cancelled, price: 20 }),
    ]);

    assert.equal(formatPercentage(metrics.completionRate), "25%");
    assert.equal(formatPercentage(metrics.cancellationRate), "25%");
    assert.equal(formatPercentage(metrics.pendingShare), "50%");
  });

  it("sorts upcoming active revenue by date and time", () => {
    const upcoming = getUpcomingRevenueAppointments([
      appointment({ status: APPOINTMENT_STATUS.confirmed, price: 40, date: "2026-08-06", time: "12:00" }),
      appointment({ status: APPOINTMENT_STATUS.completed, price: 50, date: "2026-08-05", time: "10:00" }),
      appointment({ status: APPOINTMENT_STATUS.pending, price: 30, date: "2026-08-05", time: "09:00" }),
    ]);

    assert.equal(upcoming.length, 2);
    assert.equal(upcoming[0].time, "09:00");
  });

  it("accepts legacy flat service prices", () => {
    assert.equal(getServicePrice({ servicePrice: "35" }), 35);
  });
});
