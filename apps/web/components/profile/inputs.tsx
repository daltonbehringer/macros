"use client";

import type { ActivityLevel, UnitSystem } from "@macros/shared";
import { useMemo } from "react";
import {
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  roundDisplay,
} from "@/lib/units";

export const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  label: string;
  hint: string;
}[] = [
  { value: "sedentary", label: "Sedentary", hint: "Little or no exercise" },
  { value: "light", label: "Light", hint: "Exercise 1–3 days/week" },
  { value: "moderate", label: "Moderate", hint: "Exercise 3–5 days/week" },
  { value: "active", label: "Active", hint: "Exercise 6–7 days/week" },
  {
    value: "very_active",
    label: "Very active",
    hint: "Hard exercise daily or physical job",
  },
];

export function ToggleGroup<T extends string | null>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            type="button"
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            className={`rounded px-3 py-1 text-sm ${
              active
                ? "bg-[color:var(--color-accent)] font-medium text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  placeholder,
  suffix,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          onChange(n);
        }}
        className="w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
      />
      {suffix && (
        <span className="text-sm text-zinc-500 tabular-nums">{suffix}</span>
      )}
    </div>
  );
}

export function WeightInput({
  unit,
  weightKg,
  onChange,
}: {
  unit: UnitSystem;
  weightKg: number | null;
  onChange: (kg: number | null) => void;
}) {
  if (unit === "metric") {
    return (
      <NumberInput
        value={weightKg !== null ? Number(roundDisplay(weightKg, 1)) : null}
        onChange={onChange}
        suffix="kg"
        min={1}
        max={500}
      />
    );
  }
  const lb = weightKg !== null ? Number(roundDisplay(kgToLb(weightKg), 1)) : null;
  return (
    <NumberInput
      value={lb}
      onChange={(v) => onChange(v === null ? null : lbToKg(v))}
      suffix="lb"
      min={1}
      max={1100}
    />
  );
}

export function HeightInput({
  unit,
  heightCm,
  onChange,
}: {
  unit: UnitSystem;
  heightCm: number | null;
  onChange: (cm: number | null) => void;
}) {
  if (unit === "metric") {
    return (
      <NumberInput
        value={heightCm !== null ? Number(roundDisplay(heightCm, 1)) : null}
        onChange={onChange}
        suffix="cm"
        min={50}
        max={260}
      />
    );
  }
  const { feet, inches } = useMemo(
    () =>
      heightCm !== null ? cmToFeetInches(heightCm) : { feet: 0, inches: 0 },
    [heightCm],
  );
  return (
    <div className="flex items-center gap-2">
      <NumberInput
        value={heightCm !== null ? feet : null}
        onChange={(v) => {
          if (v === null) return onChange(null);
          onChange(feetInchesToCm(v, inches));
        }}
        suffix="ft"
      />
      <NumberInput
        value={heightCm !== null ? inches : null}
        onChange={(v) => {
          if (v === null) return onChange(null);
          onChange(feetInchesToCm(feet, v));
        }}
        suffix="in"
      />
    </div>
  );
}
