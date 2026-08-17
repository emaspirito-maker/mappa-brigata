import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const pending = await getFailedForRetry(db, MAX_ATTEMPTS);
  const results = await Promise.allSettled(
    pending.map((s) => generatePillola(db, anthropic, s.id))
  );

  return NextResponse.json({
    retried: pending.length,
    succeeded: results.filter((r) => r.status === "fulfilled" && r.value.ok).length,
  });
}
