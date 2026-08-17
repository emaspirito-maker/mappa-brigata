import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createDb } from "@/lib/db/client";
import { getFailedForRetry } from "@/lib/db/queries";
import { generatePillola } from "@/lib/ai/generate";

const MAX_ATTEMPTS = 5;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const pending = await getFailedForRetry(db, MAX_ATTEMPTS);
  const results = await Promise.allSettled(
    pending.map((s) => generatePillola(db, gemini, s.id))
  );

  return NextResponse.json({
    retried: pending.length,
    succeeded: results.filter((r) => r.status === "fulfilled" && r.value.ok).length,
  });
}
