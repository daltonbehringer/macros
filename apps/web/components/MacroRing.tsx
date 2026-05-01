"use client";

const SIZE = 120;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function MacroRing({
  label,
  value,
  target,
  unit,
  accent,
}: {
  label: string;
  value: number;
  target: number | null;
  unit: string;
  accent?: boolean;
}) {
  const pct =
    target && target > 0 ? Math.min(value / target, 1.15) : 0;
  const offset = CIRCUMFERENCE * (1 - Math.min(pct, 1));
  const stroke = accent
    ? "var(--color-accent)"
    : "rgb(161 161 170)"; // zinc-400
  const overshoot = pct > 1;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-zinc-200 dark:stroke-zinc-800"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            stroke={overshoot ? "rgb(220 38 38)" : stroke}
            style={{
              transition:
                "stroke-dashoffset 400ms cubic-bezier(0.4, 0.0, 0.2, 1), stroke 200ms ease",
            }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-2xl font-semibold tabular-nums ${
              accent ? "text-[color:var(--color-accent)]" : ""
            }`}
          >
            {Math.round(value)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 tabular-nums">
            {target !== null ? `/ ${Math.round(target)}` : "—"}
          </span>
        </div>
      </div>
      <div className="mt-2 text-xs uppercase tracking-widest text-zinc-500">
        {label} <span className="ml-1 normal-case text-zinc-400">{unit}</span>
      </div>
    </div>
  );
}
