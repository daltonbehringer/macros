"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type Me } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "unknown error");
      });
  }, [router]);

  const onLogout = async () => {
    await api.logout().catch(() => {});
    router.replace("/login");
  };

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 px-6">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center px-6">
        <p className="text-zinc-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="font-mono text-sm uppercase tracking-widest text-zinc-500">
        macros
      </h1>
      <p className="text-4xl font-semibold tracking-tight">
        Signed in as{" "}
        <span className="text-[color:var(--color-accent)]">{me.user.email}</span>
      </p>
      <p className="text-zinc-600 dark:text-zinc-400">
        Dashboard, chat, and history ship in the next PRs.
      </p>
      <button
        onClick={onLogout}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Sign out
      </button>
    </main>
  );
}
