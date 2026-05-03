import { DashboardPreview } from "./DashboardPreview";

const STEPS = [
  { n: "01", label: "Type", body: "Tell it what you ate, in plain language." },
  { n: "02", label: "Done", body: "Macros parses it. No barcodes. No databases." },
  { n: "03", label: "See", body: "Today, this week, this month — all in one place." },
];

const ANTI_FEATURES = [
  "No barcode scanner.",
  "No 800,000-item food database to search.",
  "No friend feed.",
  "No streaks.",
  "No premium tier.",
  "No ads.",
];

export function Landing() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Subtle ambient background — present but barely */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35] dark:opacity-100"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 0%, rgba(0,224,138,0.08), transparent 40%), radial-gradient(circle at 85% 30%, rgba(0,224,138,0.06), transparent 45%)",
        }}
      />

      <Nav />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 sm:pt-24 sm:pb-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Nutrition tracking · plain language
        </p>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight sm:text-7xl">
          Tracking,
          <br />
          <span className="text-[color:var(--color-accent)]">in plain language.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
          Tell it what you ate. It does the math. No barcode scanner, no
          800,000-item food database, no friend feed. Just a tracker that
          listens.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-[color:var(--color-accent)] px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-[color:var(--color-accent-hover)]"
          >
            Start tracking
            <span aria-hidden>→</span>
          </a>
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            Magic-link sign in · no password
          </p>
        </div>
      </section>

      {/* Demo block */}
      <section className="mx-auto max-w-5xl px-6 pb-24 sm:pb-32">
        <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          What you'll see
        </p>
        <DashboardPreview />
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 pb-24 sm:pb-32">
        <p className="mb-12 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          How it works
        </p>
        <ol className="grid gap-12 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs tabular-nums text-zinc-400">
                  {s.n}
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {s.label}
                </span>
              </div>
              <p className="mt-4 text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Anti-feature callout */}
      <section className="mx-auto max-w-5xl px-6 pb-24 sm:pb-32">
        <div className="border-l-2 border-[color:var(--color-accent)] pl-6 sm:pl-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            What it doesn't do
          </p>
          <ul className="mt-6 space-y-2 font-mono text-sm text-zinc-500 sm:text-base">
            {ANTI_FEATURES.map((line) => (
              <li key={line} className="flex items-baseline gap-3">
                <span className="text-zinc-700 dark:text-zinc-600">—</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            Just type what you ate.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24 sm:pb-32">
        <div className="border-t border-zinc-200 pt-16 dark:border-zinc-900">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Ready?
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Try the simplest food tracker
            <br />
            you've ever used.
          </h2>
          <a
            href="/login"
            className="mt-10 inline-flex items-center gap-2 rounded-md bg-[color:var(--color-accent)] px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-[color:var(--color-accent-hover)]"
          >
            Start tracking
            <span aria-hidden>→</span>
          </a>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between border-t border-zinc-200 pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:border-zinc-900">
          <span>macros · {year}</span>
          <a
            href="/login"
            className="hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Sign in
          </a>
        </div>
      </footer>
    </div>
  );
}

function Nav() {
  return (
    <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-8">
      <a
        href="/"
        className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-900 dark:text-zinc-100"
      >
        macros
      </a>
      <a
        href="/login"
        className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        Sign in
      </a>
    </nav>
  );
}
