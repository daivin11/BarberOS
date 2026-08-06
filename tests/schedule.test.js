import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUSINESS_HOURS_LIMITS,
  createSlotId,
  getOccupiedTimes,
  getSafeScheduleDuration,
  getTimeSlots,
  isFutureAppointmentStart,
  isTimeSlotAvailable,
  isValidDateString,
  isValidAppointmentTime,
  isValidTimeString,
  normalizeBlockedDates,
  normalizeBusinessHours,
  overlaps,
  timeToMinutes,
  validateBlockedDatesInput,
  validateBusinessHoursInput,
} from "../src/utils/schedule.js";

describe("schedule utils", () => {
  it("converts time strings to minutes", () => {
    assert.equal(timeToMinutes("09:30"), 570);
    assert.equal(timeToMinutes("18:00"), 1080);
  });

  it("creates deterministic safe slot ids", () => {
    assert.equal(
      createSlotId({
        userId: "user/1",
        barberId: "barber 2",
        date: "2026-07-29",
        time: "09:30",
      }),
      "user_1_barber_2_2026-07-29_09_30"
    );
  });

  it("generates only start times that fit the service duration", () => {
    assert.deepEqual(
      getTimeSlots({
        businessHours: { start: "09:00", end: "10:00", slotInterval: 15 },
        duration: 30,
      }),
      ["09:00", "09:15", "09:30"]
    );
  });

  it("expands a multi-slot service reservation", () => {
    assert.deepEqual(
      getOccupiedTimes({
        startMinutes: timeToMinutes("09:00"),
        endMinutes: timeToMinutes("10:00"),
        interval: 30,
      }),
      ["09:00", "09:30"]
    );
  });

  it("detects overlapping appointment windows", () => {
    assert.equal(overlaps(540, 600, 570, 630), true);
    assert.equal(overlaps(540, 600, 600, 660), false);
  });

  it("sanitizes schedule durations before availability math", () => {
    assert.equal(getSafeScheduleDuration(45), 45);
    assert.equal(getSafeScheduleDuration("bad"), 30);
    assert.equal(getSafeScheduleDuration(30.5), 30);
    assert.equal(getSafeScheduleDuration(20), 30);
    assert.equal(getSafeScheduleDuration(500), 30);
  });

  it("detects whether a public booking slot is still available", () => {
    const bookedSlots = [
      { time: "10:00", startMinutes: 600, endMinutes: 660, duration: 60 },
    ];

    assert.equal(isTimeSlotAvailable({ time: "09:30", duration: 30, bookedSlots }), true);
    assert.equal(isTimeSlotAvailable({ time: "10:30", duration: 30, bookedSlots }), false);
    assert.equal(isTimeSlotAvailable({ time: "11:00", duration: 30, bookedSlots }), true);
    assert.equal(isTimeSlotAvailable({ time: "bad", duration: 30, bookedSlots }), false);
    assert.equal(isTimeSlotAvailable({ time: "09:30", duration: "bad", bookedSlots }), true);
  });

  it("validates schedule boundaries and configured interval", () => {
    const businessHours = { start: "09:00", end: "18:00", slotInterval: 30 };

    assert.equal(
      isValidAppointmentTime({
        date: "2026-07-29",
        time: "09:30",
        duration: 60,
        businessHours,
        today: "2026-07-29",
      }),
      true
    );
    assert.equal(
      isValidAppointmentTime({
        date: "2026-07-28",
        time: "09:30",
        duration: 60,
        businessHours,
        today: "2026-07-29",
      }),
      false
    );
    assert.equal(
      isValidAppointmentTime({
        date: "2026-07-29",
        time: "09:15",
        duration: 60,
        businessHours,
        today: "2026-07-29",
      }),
      false
    );
    assert.equal(
      isValidAppointmentTime({
        date: "2026-07-29",
        time: "17:30",
        duration: 60,
        businessHours,
        today: "2026-07-29",
      }),
      false
    );
    assert.equal(
      isValidAppointmentTime({
        date: "2026-07-29",
        time: "17:45",
        duration: "bad",
        businessHours,
        today: "2026-07-29",
      }),
      false
    );
  });


  it("validates business hours and blocked date contracts", () => {
    assert.equal(isValidTimeString("09:30"), true);
    assert.equal(isValidTimeString("24:00"), false);
    assert.equal(isValidDateString("2026-07-30"), true);
    assert.equal(isValidDateString("2026-02-31"), false);

    assert.equal(validateBusinessHoursInput({ start: "09:00", end: "18:00", slotInterval: 30 }), "");
    assert.equal(
      validateBusinessHoursInput({ start: "18:00", end: "09:00", slotInterval: 30 }),
      "O horario de fechamento precisa ser depois da abertura."
    );
    assert.equal(
      validateBusinessHoursInput({ start: "09:00", end: "18:00", slotInterval: 10 }),
      "Escolha um intervalo valido para a agenda."
    );

    assert.deepEqual(normalizeBusinessHours({ start: "08:00", end: "17:00", slotInterval: 45 }), {
      start: "08:00",
      end: "17:00",
      slotInterval: 45,
    });
    assert.deepEqual(normalizeBlockedDates(["2026-07-30", "invalid", "2026-07-30"]), ["2026-07-30"]);
    assert.equal(validateBlockedDatesInput(["2026-07-30"]), "");
    assert.equal(validateBlockedDatesInput(["invalid"]), "Remova datas bloqueadas invalidas antes de salvar.");

    const tooManyDates = Array.from(
      { length: BUSINESS_HOURS_LIMITS.blockedDatesMax + 1 },
      (_, index) => `2026-12-${String((index % 28) + 1).padStart(2, "0")}`
    );
    assert.match(validateBlockedDatesInput(tooManyDates), /Use no maximo/);
  });

  it("detects whether appointment start is still in the future", () => {
    const now = new Date("2026-07-29T12:00:00");

    assert.equal(isFutureAppointmentStart({ date: "2026-07-28", time: "13:00", now }), false);
    assert.equal(isFutureAppointmentStart({ date: "2026-07-29", time: "11:59", now }), false);
    assert.equal(isFutureAppointmentStart({ date: "2026-07-29", time: "12:00", now }), false);
    assert.equal(isFutureAppointmentStart({ date: "2026-07-29", time: "12:01", now }), true);
    assert.equal(isFutureAppointmentStart({ date: "2026-07-30", time: "09:00", now }), true);
  });
});
