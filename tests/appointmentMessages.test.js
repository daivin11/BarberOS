import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APPOINTMENT_STATUS } from "../src/utils/appointments.js";
import { createAppointmentWhatsAppMessage } from "../src/utils/appointmentMessages.js";

describe("appointment WhatsApp messages", () => {
  it("asks for confirmation when appointment is pending", () => {
    const message = createAppointmentWhatsAppMessage({
      clientName: "Ana",
      service: { name: "Corte" },
      date: "2026-08-05",
      time: "10:00",
      status: APPOINTMENT_STATUS.pending,
    });

    assert.match(message, /Recebemos sua solicitacao/);
    assert.match(message, /Podemos confirmar esse horario/);
  });

  it("sends confirmation copy for confirmed appointments", () => {
    const message = createAppointmentWhatsAppMessage({
      clientName: "Ana",
      serviceName: "Barba",
      date: "2026-08-05",
      time: "11:00",
      status: APPOINTMENT_STATUS.confirmed,
    });

    assert.match(message, /esta confirmado/);
    assert.match(message, /Barba/);
  });
});
