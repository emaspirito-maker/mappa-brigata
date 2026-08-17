import { eq, and, lt, count, isNotNull } from "drizzle-orm";
import { submissions, type Submission } from "./schema";
import type { Db } from "./client";

export async function createSubmission(
  db: Db,
  input: { nome: string; cognome: string; email: string; azienda: string; sessionId: string }
): Promise<Submission> {
  const [row] = await db
    .insert(submissions)
    .values({
      id: crypto.randomUUID(),
      nome: input.nome,
      cognome: input.cognome,
      email: input.email,
      azienda: input.azienda,
      sessionId: input.sessionId,
    })
    .returning();
  return row;
}

const ANSWER_FIELD = {
  cuoco: "rispostaCuocoDiLinea",
  sousChef: "rispostaSousChef",
  chef: "rispostaChef",
} as const;

export async function saveAnswer(
  db: Db,
  id: string,
  field: keyof typeof ANSWER_FIELD,
  value: string
): Promise<void> {
  await db
    .update(submissions)
    .set({ [ANSWER_FIELD[field]]: value, updatedAt: new Date() })
    .where(eq(submissions.id, id));
}

export async function markProcessing(db: Db, id: string): Promise<void> {
  await db
    .update(submissions)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(submissions.id, id));
}

export async function markDone(db: Db, id: string, pillola: string): Promise<void> {
  await db
    .update(submissions)
    .set({ status: "done", pillolaGenerata: pillola, updatedAt: new Date() })
    .where(eq(submissions.id, id));
}

export async function markFailed(db: Db, id: string): Promise<void> {
  const current = await getById(db, id);
  const nextAttempt = (current?.attemptCount ?? 0) + 1;
  await db
    .update(submissions)
    .set({ status: "failed", attemptCount: nextAttempt, updatedAt: new Date() })
    .where(eq(submissions.id, id));
}

export async function getBySessionId(db: Db, sessionId: string): Promise<Submission | undefined> {
  const [row] = await db.select().from(submissions).where(eq(submissions.sessionId, sessionId));
  return row;
}

export async function getById(db: Db, id: string): Promise<Submission | undefined> {
  const [row] = await db.select().from(submissions).where(eq(submissions.id, id));
  return row;
}

export async function getFailedForRetry(db: Db, maxAttempts: number): Promise<Submission[]> {
  return db
    .select()
    .from(submissions)
    .where(and(eq(submissions.status, "failed"), lt(submissions.attemptCount, maxAttempts)));
}

export async function getStats(db: Db): Promise<{ started: number; done: number }> {
  const [{ started }] = await db.select({ started: count() }).from(submissions);
  const [{ done }] = await db
    .select({ done: count() })
    .from(submissions)
    .where(eq(submissions.status, "done"));
  return { started: Number(started), done: Number(done) };
}

export async function getAllForExport(db: Db): Promise<Submission[]> {
  return db.select().from(submissions);
}
