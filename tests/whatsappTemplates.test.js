import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getWhatsAppTemplateById,
  renderWhatsAppTemplate,
  WHATSAPP_TEMPLATES,
} from "../src/utils/whatsappTemplates.js";

describe("WhatsApp templates", () => {
  it("keeps a useful catalog for client relationship workflows", () => {
    assert.equal(WHATSAPP_TEMPLATES.length >= 5, true);
    assert.equal(WHATSAPP_TEMPLATES.some((template) => template.id === "review"), true);
    assert.equal(WHATSAPP_TEMPLATES.some((template) => template.id === "reschedule"), true);
  });

  it("renders accepted variables into the selected message", () => {
    const message = renderWhatsAppTemplate("Oi {clientName} da {barbershopName} em {date} as {time}", {
      clientName: "Ana",
      barbershopName: "Barbearia Central",
      date: "05/08",
      time: "10:00",
    });

    assert.equal(message, "Oi Ana da Barbearia Central em 05/08 as 10:00");
  });

  it("falls back to the first template when the id is unknown", () => {
    assert.equal(getWhatsAppTemplateById("missing").id, WHATSAPP_TEMPLATES[0].id);
  });
});
