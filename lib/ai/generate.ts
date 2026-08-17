import type { GoogleGenAI } from "@google/genai";
import type { Db } from "@/lib/db/client";
import { getById, markProcessing, markDone, markFailed } from "@/lib/db/queries";
import { buildPrompt } from "./prompt";
import { generateReflection } from "./client";

const CALL_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function generatePillola(
  db: Db,
  aiClient: GoogleGenAI,
  submissionId: string
): Promise<{ ok: true; pillola: string } | { ok: false }> {
  const submission = await getById(db, submissionId);
  if (
    !submission ||
    !submission.rispostaCuocoDiLinea ||
    !submission.rispostaSousChef ||
    !submission.rispostaChef
  ) {
    return { ok: false };
  }

  await markProcessing(db, submissionId);

  const prompt = buildPrompt({
    cuoco: submission.rispostaCuocoDiLinea,
    sousChef: submission.rispostaSousChef,
    chef: submission.rispostaChef,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const pillola = await withTimeout(generateReflection(aiClient, prompt), CALL_TIMEOUT_MS);
      await markDone(db, submissionId, pillola);
      return { ok: true, pillola };
    } catch {
      // fall through to retry or final failure below
    }
  }

  await markFailed(db, submissionId);
  return { ok: false };
}
