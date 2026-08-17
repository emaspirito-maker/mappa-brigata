import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDb } from "@/lib/db/client";
import { getBySessionId } from "@/lib/db/queries";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export default async function PillolaPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) redirect("/registrazione");

  const db = createDb(process.env.DATABASE_URL!);
  const submission = await getBySessionId(db, sessionId);
  if (!submission) redirect("/registrazione");
  if (submission.status !== "done" || !submission.pillolaGenerata) redirect("/elaborazione");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink500">La tua pillola</p>
      <p className="text-xl leading-relaxed text-brand-ink900">{submission.pillolaGenerata}</p>
    </main>
  );
}
