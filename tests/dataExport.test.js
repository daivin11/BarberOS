import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWorkspaceExportFilename, createWorkspaceExportPayload } from "../src/utils/dataExport.js";

describe("data export utils", () => {
  it("creates a portable workspace export with counts and ISO dates", () => {
    const generatedAt = new Date("2026-08-05T12:00:00.000Z");
    const payload = createWorkspaceExportPayload(
      {
        owner: { uid: "owner-1", email: "owner@example.com" },
        profile: { barbershopName: "BarberOS Centro", createdAt: generatedAt },
        clients: [{ id: "client-1", name: "Davi", createdAt: generatedAt }],
        archivedClients: [],
        services: [{ id: "service-1", name: "Corte" }],
        archivedServices: [],
        barbers: [],
        archivedBarbers: [],
        appointments: [{ id: "appointment-1", date: "2026-08-05" }],
        auditLogs: [{ id: "log-1", createdAt: { toDate: () => generatedAt } }],
      },
      { generatedAt }
    );

    assert.equal(payload.product, "BarberOS");
    assert.equal(payload.generatedAt, "2026-08-05T12:00:00.000Z");
    assert.equal(payload.counts.clients, 1);
    assert.equal(payload.counts.profile, 1);
    assert.equal(payload.data.profile.createdAt, "2026-08-05T12:00:00.000Z");
    assert.equal(payload.data.auditLogs[0].createdAt, "2026-08-05T12:00:00.000Z");
  });

  it("creates a stable safe filename", () => {
    assert.equal(
      createWorkspaceExportFilename(
        { barbershopName: "Barbearia São João!" },
        new Date("2026-08-05T12:00:00.000Z")
      ),
      "barbearia-sao-joao-export-2026-08-05.json"
    );
  });
});
