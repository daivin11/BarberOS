import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBookingConfirmation, getBookingConfirmationLines } from "../src/utils/bookingConfirmation.js";

describe("booking confirmation utils", () => {
  it("creates a pending confirmation snapshot for the public flow", () => {
    const confirmation = createBookingConfirmation({
      clientName: " Ana ",
      clientPhone: "11987654321",
      service: { name: "Corte", price: 45, duration: 30 },
      barber: { name: "Joao" },
      date: "2026-08-05",
      time: "10:00",
    });

    assert.equal(confirmation.clientName, "Ana");
    assert.equal(confirmation.serviceName, "Corte");
    assert.equal(confirmation.barberName, "Joao");
    assert.equal(confirmation.status, "pending");
  });

  it("formats confirmation lines for the success screen", () => {
    const lines = getBookingConfirmationLines({
      clientName: "Ana",
      serviceName: "Corte",
      servicePrice: 45,
      serviceDuration: 30,
      barberName: "Joao",
      date: "2026-08-05",
      time: "10:00",
    });

    assert.deepEqual(lines[0], ["Cliente", "Ana"]);
    assert.equal(lines[2][0], "Duracao e valor");
    assert.match(lines[2][1], /^30 minutos - R\$\s45,00$/);
    assert.deepEqual(lines[5], ["Horario", "10:00"]);
  });
});
