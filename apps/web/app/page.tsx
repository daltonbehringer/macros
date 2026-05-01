export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="font-mono text-sm uppercase tracking-widest text-zinc-500">
        macros
      </h1>
      <p className="text-4xl font-semibold tracking-tight">
        Conversational nutrition tracking.
      </p>
      <p className="text-zinc-600 dark:text-zinc-400">
        Scaffolding only — auth, dashboard, and chat ship in the next PRs.
      </p>
      <a
        className="text-[color:var(--color-accent)] hover:underline"
        href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/health`}
        target="_blank"
        rel="noreferrer"
      >
        api /health →
      </a>
    </main>
  );
}
