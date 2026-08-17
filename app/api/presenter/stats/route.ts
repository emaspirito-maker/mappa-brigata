import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDb } from "@/lib/db/client";
import { getStats } from "@/lib/db/queries";
import { PRESENTER_COOKIE_NAME } from "@/lib/presenter-auth";

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get(PRESENTER_COOKIE_NAME)?.value !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const stats = await getStats(db);
  return NextResponse.json(stats);
}
