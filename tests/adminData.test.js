import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENT_LIMITS,
  createClientSnapshot,
  createClientPhoneKeyId,
  getDateValue,
  normalizeClientInput,
  normalizePhone,
  sortAppointments,
  sortByCreatedAtDesc,
  sortByName,
  upsertById,
  validateClientInput,
} from "../src/utils/adminData.js";

describe("admin data utils", () => {
  it("normalizes Brazilian phone input to digits only", () => {
    assert.equal(normalizePhone("(11) 98888-7777"), "11988887777");
    assert.equal(normalizePhone(null), "");
  });

  it("normalizes client input before persistence", () => {
    assert.deepEqual(
      normalizeClientInput({ name: "  Ana   Silva  ", phone: "+55 (11) 98888-7777" }),
      {
        name: "Ana Silva",
        phone: "5511988887777",
      }
    );
  });

  it("validates the Firestore client field bounds", () => {
    assert.equal(
      validateClientInput({ name: "A", phone: "11988887777" }),
      `Nome do cliente deve ter entre ${CLIENT_LIMITS.nameMin} e ${CLIENT_LIMITS.nameMax} caracteres.`
    );
    assert.equal(validateClientInput({ name: "Ana Silva", phone: "123" }), "Informe um telefone valido com DDD.");
    assert.equal(validateClientInput({ name: "Ana Silva", phone: "11988887777" }), "");
  });

  it("creates deterministic phone key ids safe for Firestore documents", () => {
    assert.equal(
      createClientPhoneKeyId({ userId: "owner/1", phone: "+55 (11) 98888-7777" }),
      "owner_1_5511988887777"
    );
  });

  it("creates appointment-safe client snapshots", () => {
    assert.deepEqual(
      createClientSnapshot({
        id: "client-1",
        name: "  Ana   Silva  ",
        phone: "(11) 98888-7777",
        phoneNormalized: "11988887777",
        userId: "owner-1",
        barberSlug: "barbearia",
        isArchived: false,
        archivedAt: new Date("2026-08-01T10:00:00.000Z"),
      }),
      {
        id: "client-1",
        name: "Ana Silva",
        phone: "11988887777",
        userId: "owner-1",
        barberSlug: "barbearia",
      }
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

  it("upserts synced local items without duplicating ids", () => {
    const nextItems = upsertById(
      [
        { id: "1", name: "Ana", phone: "11988887777" },
        { id: "2", name: "Bruno", phone: "21988887777" },
      ],
      { id: "1", name: "Ana Maria" }
    );

    assert.deepEqual(nextItems, [
      { id: "1", name: "Ana Maria", phone: "11988887777" },
      { id: "2", name: "Bruno", phone: "21988887777" },
    ]);
    assert.deepEqual(upsertById(nextItems, { id: "3", name: "Caio" }).map((item) => item.id), ["1", "2", "3"]);
    assert.deepEqual(upsertById(nextItems, { name: "Sem id" }), nextItems);
  });
});
