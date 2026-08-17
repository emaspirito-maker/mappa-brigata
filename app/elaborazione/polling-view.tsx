"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "pending" | "processing" | "done" | "failed";

// No always-on server cron is available on the Hobby plan (Vercel limits
// cron jobs to once/day there), so while a participant's tab is open and
// polling, it drives its own retry: it re-triggers generation itself when
// it observes a failure, instead of waiting for the daily safety-net cron.
const CLIENT_RETRY_COOLDOWN_MS = 12_000;

export default function PollingView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("processing");
  const [attemptCount, setAttemptCount] = useState(0);
  const lastRetriedAttemptCount = useRef(-1);
  const retryCooldownUntil = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      const res = await fetch("/api/submission-status");
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as {
        submissionId: string;
        status: Status;
        attemptCount: number;
      };
      setStatus(data.status);
      setAttemptCount(data.attemptCount);

      if (data.status === "done") {
        clearInterval(interval);
        router.push("/pillola");
        return;
      }

      if (
        data.status === "failed" &&
        data.attemptCount !== lastRetriedAttemptCount.current &&
        Date.now() > retryCooldownUntil.current
      ) {
        lastRetriedAttemptCount.current = data.attemptCount;
        retryCooldownUntil.current = Date.now() + CLIENT_RETRY_COOLDOWN_MS;
        fetch("/api/generate-pillola", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId: data.submissionId }),
        }).catch(() => {});
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  if (status === "failed" && attemptCount >= 2) {
    return (
      <p className="text-brand-ink900">
        Ci siamo quasi, la tua pillola si sta ancora generando — riapri questa pagina tra
        qualche minuto.
      </p>
    );
  }

  if (status === "failed") {
    return <p className="text-brand-ink900">Qualcosa è andato storto, ci stiamo riprovando automaticamente…</p>;
  }

  return <p className="text-brand-ink900">Stiamo leggendo le tue risposte…</p>;
}
