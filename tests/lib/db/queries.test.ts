import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, type TestDb } from "@/tests/helpers/test-db";
import {
  createSubmission,
  saveAnswer,
  markProcessing,
  markDone,
  markFailed,
  getBySessionId,
  getById,
  getFailedForRetry,
  getStats,
  getAllForExport,
} from "@/lib/db/queries";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});

describe("createSubmission + getBySessionId", () => {
  it("creates a row retrievable by sessionId", async () => {
    const created = await createSubmission(db, {
      nome: "Mario",
      cognome: "Rossi",
      email: "mario@example.com",
      azienda: "Rossi Store",
      sessionId: "sess-1",
    });
    expect(created.status).toBe("pending");
    expect(created.attemptCount).toBe(0);

    const found = await getBySessionId(db, "sess-1");
    expect(found?.id).toBe(created.id);
    expect(found?.email).toBe("mario@example.com");
  });
});

describe("saveAnswer", () => {
  it("writes each answer field incrementally", async () => {
    const created = await createSubmission(db, {
      nome: "Mario", cognome: "Rossi", email: "mario@example.com",
      azienda: "Rossi Store", sessionId: "sess-2",
    });
    await saveAnswer(db, created.id, "cuoco", "Rispondere alle mail");
    await saveAnswer(db, created.id, "sousChef", "Controllo la fattura");
    await saveAnswer(db, created.id, "chef", "Assumere qualcuno");

    const found = await getById(db, created.id);
    expect(found?.rispostaCuocoDiLinea).toBe("Rispondere alle mail");
    expect(found?.rispostaSousChef).toBe("Controllo la fattura");
    expect(found?.rispostaChef).toBe("Assumere qualcuno");
  });
});

describe("status transitions", () => {
  it("moves pending -> processing -> done", async () => {
    const created = await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-3",
    });
    await markProcessing(db, created.id);
    expect((await getById(db, created.id))?.status).toBe("processing");

    await markDone(db, created.id, "La tua pillola.");
    const done = await getById(db, created.id);
    expect(done?.status).toBe("done");
    expect(done?.pillolaGenerata).toBe("La tua pillola.");
  });

  it("increments attemptCount on failure and is retrievable for retry", async () => {
    const created = await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-4",
    });
    await markFailed(db, created.id);
    await markFailed(db, created.id);

    const found = await getById(db, created.id);
    expect(found?.status).toBe("failed");
    expect(found?.attemptCount).toBe(2);

    const retryable = await getFailedForRetry(db, 5);
    expect(retryable.map((s) => s.id)).toContain(created.id);
  });

  it("excludes submissions that exceeded max attempts from retry", async () => {
    const created = await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-5",
    });
    for (let i = 0; i < 5; i++) await markFailed(db, created.id);

    const retryable = await getFailedForRetry(db, 5);
    expect(retryable.map((s) => s.id)).not.toContain(created.id);
  });
});

describe("getStats", () => {
  it("counts started and done submissions separately", async () => {
    const s1 = await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-6",
    });
    await createSubmission(db, {
      nome: "C", cognome: "D", email: "c@example.com", azienda: "Y", sessionId: "sess-7",
    });
    await markDone(db, s1.id, "pillola");

    const stats = await getStats(db);
    expect(stats.started).toBe(2);
    expect(stats.done).toBe(1);
  });
});

describe("getAllForExport", () => {
  it("returns every submission", async () => {
    await createSubmission(db, {
      nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId: "sess-8",
    });
    await createSubmission(db, {
      nome: "C", cognome: "D", email: "c@example.com", azienda: "Y", sessionId: "sess-9",
    });
    const all = await getAllForExport(db);
    expect(all).toHaveLength(2);
  });
});
