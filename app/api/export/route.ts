import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDb } from "@/lib/db/client";
import { getAllForExport } from "@/lib/db/queries";
import { PRESENTER_COOKIE_NAME } from "@/lib/presenter-auth";
import { submissionsToCsv } from "@/lib/csv";

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get(PRESENTER_COOKIE_NAME)?.value !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createDb(process.env.DATABASE_URL!);
  const rows = await getAllForExport(db);
  const csv = submissionsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brigata-submissions-${Date.now()}.csv"`,
    },
  });
}
