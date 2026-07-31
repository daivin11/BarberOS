import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createClientPhoneKeyId,
  getDateValue,
  normalizePhone,
  sortAppointments,
  sortByCreatedAtDesc,
  sortByName,
} from "../src/utils/adminData.js";

describe("admin data utils", () => {
  it("normalizes Brazilian phone input to digits only", () => {
    assert.equal(normalizePhone("(11) 98888-7777"), "11988887777");
    assert.equal(normalizePhone(null), "");
  });

  it("creates deterministic phone key ids safe for Firestore documents", () => {
    assert.equal(
      createClientPhoneKeyId({ userId: "owner/1", phone: "+55 (11) 98888-7777" }),
      "owner_1_5511988887777"
    );
  });

  it("extracts comparable dates from Firestore timestamps, dates and strings", () => {
    assert.equal(getDateValue({ toMillis: () => 1234 }), 1234);
    assert.equal(getDateValue(new Date("2026-07-29T12:00:00Z")), Date.parse("2026-07-29T12:00:00Z"));
    assert.equal(getDateValue("not-a-date"), 0);
  });

  it("sorts by name without mutating the original array", () => {
    const original = [{ name: "Zulu" }, { name: "Ana" }];
    const sorted = sortByName(original);

    assert.deepEqual(sorted.map((item) => item.name), ["Ana", "Zulu"]);
    assert.deepEqual(original.map((item) => item.name), ["Zulu", "Ana"]);
  });

  it("sorts created items from newest to oldest", () => {
    const sorted = sortByCreatedAtDesc([
      { id: "old", createdAt: "2026-07-01" },
      { id: "new", createdAt: "2026-07-29" },
    ]);

    assert.deepEqual(sorted.map((item) => item.id), ["new", "old"]);
  });

  it("sorts appointments chronologically by date and time", () => {
    const sorted = sortAppointments([
      { id: "late", date: "2026-07-30", time: "09:00" },
      { id: "early", date: "2026-07-29", time: "18:00" },
      { id: "first", date: "2026-07-29", time: "09:00" },
    ]);

    assert.deepEqual(sorted.map((item) => item.id), ["first", "early", "late"]);
  });
});
