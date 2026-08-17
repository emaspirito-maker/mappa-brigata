import Link from "next/link";

export default function IntroPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-ink900">Una brigata, tre ruoli</h1>
      <ul className="flex flex-col gap-4 text-brand-ink900">
        <li><strong>Cuoco di linea</strong> — esegue, ripete, non decide.</li>
        <li><strong>Sous-chef</strong> — controlla, verifica, segnala le anomalie.</li>
        <li><strong>Chef</strong> — decide, valida, si prende la responsabilità finale.</li>
      </ul>
      <Link
        href="/domande"
        className="rounded-sm bg-brand-orange px-6 py-3 text-center font-semibold text-white active:bg-brand-orangePress"
      >
        Continua
      </Link>
    </main>
  );
}
