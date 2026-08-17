import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDb } from "@/lib/db/client";
import { createSubmission } from "@/lib/db/queries";
import { isValidEmail, isNonEmpty } from "@/lib/validation";
import { SESSION_COOKIE_NAME, generateSessionId } from "@/lib/session";

async function registerAction(formData: FormData) {
  "use server";

  const nome = String(formData.get("nome") ?? "");
  const cognome = String(formData.get("cognome") ?? "");
  const email = String(formData.get("email") ?? "");
  const azienda = String(formData.get("azienda") ?? "");

  if (![nome, cognome, azienda].every(isNonEmpty) || !isValidEmail(email)) {
    redirect("/registrazione?error=1");
  }

  const sessionId = generateSessionId();
  const db = createDb(process.env.DATABASE_URL!);
  await createSubmission(db, { nome, cognome, email, azienda, sessionId });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/intro");
}

export default async function RegistrazionePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
      <img src="/logo-mandarino.png" alt="Mandarino" className="h-6 w-auto" />
      <h1 className="text-2xl font-semibold text-brand-ink900">Mappa la tua Brigata</h1>
      {error && (
        <p className="text-sm text-red-600">Controlla i campi: sono tutti obbligatori.</p>
      )}
      <form action={registerAction} className="flex flex-col gap-4">
        <input name="nome" placeholder="Nome" required className="rounded-xs border border-brand-hairline px-4 py-3" />
        <input name="cognome" placeholder="Cognome" required className="rounded-xs border border-brand-hairline px-4 py-3" />
        <input name="email" type="email" placeholder="Email" required className="rounded-xs border border-brand-hairline px-4 py-3" />
        <input name="azienda" placeholder="Azienda / Punto vendita" required className="rounded-xs border border-brand-hairline px-4 py-3" />
        <button type="submit" className="rounded-sm bg-brand-orange px-6 py-3 font-semibold text-white active:bg-brand-orangePress">
          Inizia
        </button>
      </form>
    </main>
  );
}
