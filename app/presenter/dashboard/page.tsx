import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PRESENTER_COOKIE_NAME } from "@/lib/presenter-auth";
import StatsView from "./stats-view";

export default async function PresenterDashboardPage() {
  const cookieStore = await cookies();
  if (cookieStore.get(PRESENTER_COOKIE_NAME)?.value !== "ok") {
    redirect("/presenter");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-brand-black px-6 py-10">
      <StatsView />
      <a
        href="/api/export"
        className="rounded-sm bg-brand-orange px-6 py-3 font-semibold text-white active:bg-brand-orangePress"
      >
        Esporta CSV
      </a>
    </main>
  );
}
