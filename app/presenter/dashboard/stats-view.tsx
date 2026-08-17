"use client";

import { useEffect, useState } from "react";

export default function StatsView() {
  const [stats, setStats] = useState({ started: 0, done: 0 });

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch("/api/presenter/stats");
      if (res.ok) setStats(await res.json());
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-white">
      <p className="text-5xl font-bold">{stats.done}</p>
      <p className="text-brand-ink500">risposte ricevute (su {stats.started} avviate)</p>
    </div>
  );
}
