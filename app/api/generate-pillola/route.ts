import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createDb } from "@/lib/db/client";
import { generatePillola } from "@/lib/ai/generate";

export async function POST(req: NextRequest) {
  const { submissionId } = (await req.json()) as { submissionId?: string };
  if (!submissionId) {
    return NextResponse.json({ error: "submissionId required" }, { status: 400 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // Not awaited: the client polls /api/submission-status for the result.
  generatePillola(db, gemini, submissionId).catch((err) => {
    console.error("generatePillola failed unexpectedly", err);
  });

  return NextResponse.json({ started: true }, { status: 202 });
}
