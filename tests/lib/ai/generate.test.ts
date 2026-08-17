import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, type TestDb } from "@/tests/helpers/test-db";
import { createSubmission, saveAnswer, getById } from "@/lib/db/queries";
import { generatePillola } from "@/lib/ai/generate";
import * as clientModule from "@/lib/ai/client";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
  vi.restoreAllMocks();
});

async function seedSubmission(sessionId: string) {
  const s = await createSubmission(db, {
    nome: "A", cognome: "B", email: "a@example.com", azienda: "X", sessionId,
  });
  await saveAnswer(db, s.id, "cuoco", "attivita A");
  await saveAnswer(db, s.id, "sousChef", "controllo B");
  await saveAnswer(db, s.id, "chef", "decisione C");
  return s;
}

describe("generatePillola", () => {
  it("marks the submission done with the generated text on success", async () => {
    const submission = await seedSubmission("sess-ok");
    vi.spyOn(clientModule, "callClaude").mockResolvedValue("Ecco la tua riflessione.");

    const result = await generatePillola(db, {} as any, submission.id);

    expect(result).toEqual({ ok: true, pillola: "Ecco la tua riflessione." });
    const row = await getById(db, submission.id);
    expect(row?.status).toBe("done");
    expect(row?.pillolaGenerata).toBe("Ecco la tua riflessione.");
  });

  it("retries once on failure, then succeeds on the second attempt", async () => {
    const submission = await seedSubmission("sess-retry");
    vi.spyOn(clientModule, "callClaude")
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("Seconda prova riuscita.");

    const result = await generatePillola(db, {} as any, submission.id);

    expect(result).toEqual({ ok: true, pillola: "Seconda prova riuscita." });
    expect(clientModule.callClaude).toHaveBeenCalledTimes(2);
  });

  it("marks the submission failed after two consecutive failures", async () => {
    const submission = await seedSubmission("sess-fail");
    vi.spyOn(clientModule, "callClaude").mockRejectedValue(new Error("down"));

    const result = await generatePillola(db, {} as any, submission.id);

    expect(result).toEqual({ ok: false });
    const row = await getById(db, submission.id);
    expect(row?.status).toBe("failed");
    expect(row?.attemptCount).toBe(1);
  });
});
