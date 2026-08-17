import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createDb } from "@/lib/db/client";
import { generatePillola } from "@/lib/ai/generate";

export async function POST(req: NextRequest) {
  const { submissionId } = (await req.json()) as { submissionId?: string };
  if (!submissionId) {
    return NextResponse.json({ error: "submissionId required" }, { status: 400 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // Not awaited: the client polls /api/submission-status for the result.
  generatePillola(db, anthropic, submissionId).catch((err) => {
    console.error("generatePillola failed unexpectedly", err);
  });

  return NextResponse.json({ started: true }, { status: 202 });
}
