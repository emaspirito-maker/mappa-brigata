import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDb } from "@/lib/db/client";
import { getBySessionId, saveAnswer, markProcessing } from "@/lib/db/queries";
import { isNonEmpty } from "@/lib/validation";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const FIELD_ORDER = ["cuoco", "sousChef", "chef"] as const;

export async function POST(req: NextRequest) {
  const { field, value } = (await req.json()) as {
    field?: (typeof FIELD_ORDER)[number];
    value?: string;
  };

  if (!field || !FIELD_ORDER.includes(field) || !value || !isNonEmpty(value)) {
    return NextResponse.json({ error: "invalid field or value" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const submission = await getBySessionId(db, sessionId);
  if (!submission) {
    return NextResponse.json({ error: "submission not found" }, { status: 404 });
  }

  await saveAnswer(db, submission.id, field, value);

  const currentIndex = FIELD_ORDER.indexOf(field);
  const nextField = FIELD_ORDER[currentIndex + 1] ?? null;

  if (!nextField) {
    await markProcessing(db, submission.id);
    await fetch(new URL("/api/generate-pillola", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: submission.id }),
    });
  }

  return NextResponse.json({ nextField });
}
