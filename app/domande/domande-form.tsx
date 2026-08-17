"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_ANSWER_LENGTH } from "@/lib/validation";

const QUESTIONS = [
  { field: "cuoco" as const, label: "Un'attività ripetitiva che fai (o fanno i tuoi collaboratori) ogni giorno o quasi" },
  { field: "sousChef" as const, label: "Un controllo che fai sempre prima di consegnare o vendere qualcosa" },
  { field: "chef" as const, label: "Una decisione che non deleghi mai a nessuno" },
];

export default function DomandeForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const question = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  async function handleNext() {
    if (value.trim().length === 0) {
      setError(true);
      return;
    }
    setSubmitting(true);
    setError(false);

    const res = await fetch("/api/domande/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: question.field, value }),
    });

    setSubmitting(false);
    if (!res.ok) {
      setError(true);
      return;
    }

    if (isLast) {
      router.push("/elaborazione");
      return;
    }
    setStep((s) => s + 1);
    setValue("");
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-brand-ink500">{step + 1}/{QUESTIONS.length}</p>
      <p className="text-lg font-medium text-brand-ink900">{question.label}</p>
      <textarea
        value={value}
        maxLength={MAX_ANSWER_LENGTH}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-xs border border-brand-hairline px-4 py-3"
        rows={3}
      />
      <p className="text-right text-xs text-brand-ink500">{value.length}/{MAX_ANSWER_LENGTH}</p>
      {error && <p className="text-sm text-red-600">Scrivi qualcosa prima di continuare.</p>}
      <button
        onClick={handleNext}
        disabled={submitting}
        className="rounded-sm bg-brand-orange px-6 py-3 font-semibold text-white active:bg-brand-orangePress disabled:opacity-50"
      >
        {isLast ? "Invia" : "Avanti"}
      </button>
    </div>
  );
}
