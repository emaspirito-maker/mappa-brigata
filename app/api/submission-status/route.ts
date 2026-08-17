import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDb } from "@/lib/db/client";
import { getBySessionId } from "@/lib/db/queries";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const submission = await getBySessionId(db, sessionId);
  if (!submission) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: submission.status,
    attemptCount: submission.attemptCount,
  });
}
