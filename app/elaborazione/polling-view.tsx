"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "pending" | "processing" | "done" | "failed";

export default function PollingView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("processing");
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      const res = await fetch("/api/submission-status");
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { status: Status; attemptCount: number };
      setStatus(data.status);
      setAttemptCount(data.attemptCount);
      if (data.status === "done") {
        clearInterval(interval);
        router.push("/pillola");
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
