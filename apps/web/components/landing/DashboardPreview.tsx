import { MacroRing } from "@/components/MacroRing";

// A static, hard-coded mock of the dashboard for the landing page. Renders the
// real MacroRing component (so the preview stays in sync as the dashboard
// evolves) inside a CRT-flavored frame: dark surface in both themes, subtle
// scanline overlay, faint accent glow on the hero number. The retro frame is
// the one place on the landing page that leans into the brand's playful side;
// the rest of the page stays editorially sober.
export function DashboardPreview() {
  const totals = { calories: 1420, proteinG: 128, carbsG: 142, fatG: 48 };
  const targets = { calories: 2200, proteinG: 165, carbsG: 220, fatG: 70 };
  const remaining = targets.calories - totals.calories;

  return (
    <div className="relative isolate">
      {/* CRT frame: thick zinc bezel, faint glow halo behind the screen */}
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,rgba(0,224,138,0.12),transparent_70%)] blur-2xl" />
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-1 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] ring-1 ring-zinc-900">
        {/* Bezel chrome row */}
        <div className="flex items-center justify-between px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent)] shadow-[0_0_6px_rgba(0,224,138,0.8)]" />
            macros / today
          </span>
          <span>v1.0</span>
        </div>

        {/* Screen */}
        <div className="relative overflow-hidden rounded-xl bg-zinc-950 px-6 py-8 sm:px-10 sm:py-10">
          {/* Scanline overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,1) 0, rgba(255,255,255,1) 1px, transparent 1px, transparent 3px)",
            }}
          />
          {/* Vignette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
            }}
          />

          <div className="relative">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Tuesday, May 5
            </p>
            <h3 className="mt-2 flex items-baseline gap-3 text-4xl font-semibold tracking-tight tabular-nums text-zinc-100 sm:text-5xl">
              <span
                className="text-[color:var(--color-accent)]"
                style={{ textShadow: "0 0 18px rgba(0, 224, 138, 0.45)" }}
              >
                {remaining}
              </span>
              <span className="text-sm font-normal text-zinc-500">
                kcal remaining
              </span>
            </h3>

            <div className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
              <MacroRing
                label="Calories"
                unit="kcal"
                value={totals.calories}
                target={targets.calories}
                accent
              />
              <MacroRing
                label="Protein"
                unit="g"
                value={totals.proteinG}
                target={targets.proteinG}
              />
              <MacroRing
                label="Carbs"
                unit="g"
                value={totals.carbsG}
                target={targets.carbsG}
              />
              <MacroRing
                label="Fat"
                unit="g"
                value={totals.fatG}
                target={targets.fatG}
              />
            </div>

            {/* Faux chat input */}
            <div className="mt-10 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3 font-mono text-sm text-zinc-300">
              <span className="text-[color:var(--color-accent)]">›</span>{" "}
              had a chicken burrito bowl for lunch
              <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-[2px] animate-pulse bg-[color:var(--color-accent)]" />
            </div>

            {/* Activity feed mock */}
            <ul className="mt-8 space-y-2 text-sm">
              <ActivityRow time="12:42" kind="meal" title="Chicken burrito bowl" detail="640 kcal · 42P · 78C · 18F" />
              <ActivityRow time="10:15" kind="workout" title="Morning run" detail="320 kcal · 32 min" />
              <ActivityRow time="07:30" kind="meal" title="Greek yogurt + berries" detail="280 kcal · 22P · 28C · 6F" />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  time,
  kind,
  title,
  detail,
}: {
  time: string;
  kind: "meal" | "workout";
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-center gap-3 text-zinc-400">
      <span className="font-mono text-xs tabular-nums text-zinc-500">
        {time}
      </span>
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          kind === "meal"
            ? "bg-[color:var(--color-accent)]"
            : "border border-zinc-500"
        }`}
      />
      <span className="text-zinc-200">{title}</span>
      <span className="ml-auto font-mono text-xs tabular-nums text-zinc-500">
        {detail}
      </span>
    </li>
  );
}
