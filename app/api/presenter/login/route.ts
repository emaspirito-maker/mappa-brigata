import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkPin, PRESENTER_COOKIE_NAME } from "@/lib/presenter-auth";

export async function POST(req: NextRequest) {
  const { pin } = (await req.json()) as { pin?: string };
  if (!pin || !checkPin(pin, process.env.PRESENTER_PIN!)) {
    return NextResponse.json({ error: "PIN errato" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(PRESENTER_COOKIE_NAME, "ok", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json({ ok: true });
}
