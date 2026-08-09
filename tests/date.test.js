import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addLocalDays, formatDateBR, formatLocalDate, parseLocalDate } from "../src/utils/date.js";

describe("date utils", () => {
  it("formats valid local dates", () => {
    assert.equal(formatLocalDate(new Date("2026-08-05T12:00:00")), "2026-08-05");
  });

  it("does not return NaN date strings for invalid input", () => {
    const formatted = formatLocalDate("data invalida");

    assert.match(formatted, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(formatted.includes("NaN"), false);
  });

  it("falls back to a valid date when parsing malformed input", () => {
    const parsed = parseLocalDate("2026-ab-cd");

    assert.equal(parsed instanceof Date, true);
    assert.equal(Number.isNaN(parsed.getTime()), false);
  });

  it("adds days using local date strings", () => {
    assert.equal(addLocalDays("2026-08-05", 2), "2026-08-07");
  });

  it("formats local date strings without UTC day shifts", () => {
    assert.equal(formatDateBR("2026-08-05"), "05/08/2026");
  });
});
