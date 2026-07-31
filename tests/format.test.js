import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCurrencyBRL, formatDuration, pluralize } from "../src/utils/format.js";

describe("format utils", () => {
  it("formats BRL currency consistently", () => {
    assert.equal(formatCurrencyBRL(45).replace(/\s/g, " "), "R$ 45,00");
    assert.equal(formatCurrencyBRL(null).replace(/\s/g, " "), "R$ 0,00");
  });

  it("formats duration labels", () => {
    assert.equal(formatDuration(1), "1 minuto");
    assert.equal(formatDuration(30), "30 minutos");
  });

  it("pluralizes simple Portuguese labels", () => {
    assert.equal(pluralize(1, "agendamento"), "1 agendamento");
    assert.equal(pluralize(2, "agendamento"), "2 agendamentos");
    assert.equal(pluralize(2, "solicitacao", "solicitacoes"), "2 solicitacoes");
  });
});
