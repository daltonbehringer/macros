"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Mode | null) ?? "system";
    setMode(stored);
    setHydrated(true);
  }, []);

  const apply = (next: Mode) => {
    setMode(next);
    if (next === "system") {
      localStorage.removeItem("theme");
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", dark);
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
    }
  };

  return (
    <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      {(["light", "system", "dark"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => apply(m)}
          className={`rounded px-3 py-1 text-xs capitalize ${
            hydrated && mode === m
              ? "bg-[color:var(--color-accent)] font-medium text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
