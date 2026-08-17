"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PresenterLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/presenter/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      setError(true);
      return;
    }
    router.push("/presenter/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 bg-brand-black px-6 py-10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="rounded-xs border border-brand-hairline bg-transparent px-4 py-3 text-white"
        />
        {error && <p className="text-sm text-brand-orange">PIN errato.</p>}
        <button type="submit" className="rounded-sm bg-brand-orange px-6 py-3 font-semibold text-white">
          Entra
        </button>
      </form>
    </main>
  );
}
