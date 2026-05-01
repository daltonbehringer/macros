"use client";

import { effectiveTargets, type Meal, type Workout } from "@macros/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type Me } from "@/lib/api";
import { formatTime, todayRange } from "@/lib/dates";

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(() => todayRange(), []);

  useEffect(() => {
    Promise.all([api.me(), api.listMeals(range), api.listWorkouts(range)])
      .then(([m, ml, w]) => {
        setMe(m);
        setMeals(ml);
        setWorkouts(w);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "unknown error");
      });
  }, [range, router]);

  const refresh = async () => {
    const [ml, w] = await Promise.all([
      api.listMeals(range),
      api.listWorkouts(range),
    ]);
    setMeals(ml);
    setWorkouts(w);
  };

  const onLogout = async () => {
    await api.logout().catch(() => {});
    router.replace("/login");
  };

  if (error) return <Centered danger>{error}</Centered>;
  if (!me) return <Centered muted>Loading…</Centered>;

  const totals = sumMacros(meals);
  const caloriesBurned = workouts.reduce((s, w) => s + w.caloriesBurned, 0);
  const targets = me.profile ? effectiveTargets(me.profile) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-zinc-500"
        >
          macros
        </a>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500">{me.user.email}</span>
          <a
            href="/settings"
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Settings
          </a>
          <button
            onClick={onLogout}
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </div>
      </header>

      <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {new Date().toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>

      <TotalsBar
        totals={totals}
        caloriesBurned={caloriesBurned}
        targets={targets}
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <MealForm onCreated={refresh} />
        <WorkoutForm onCreated={refresh} />
      </div>

      <Section title="Meals">
        {meals.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {meals.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{m.description}</span>
                    <span className="font-mono text-xs text-zinc-500">
                      {formatTime(m.consumedAt)}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-zinc-500 tabular-nums">
                    {Math.round(m.calories)} kcal · P {m.proteinG}g · C{" "}
                    {m.carbsG}g · F {m.fatG}g
                  </div>
                </div>
                <DeleteButton
                  onConfirm={async () => {
                    setMeals((xs) => xs.filter((x) => x.id !== m.id));
                    try {
                      await api.deleteMeal(m.id);
                    } catch (err) {
                      console.error("deleteMeal failed", err);
                      setError(
                        err instanceof ApiError
                          ? `delete meal: ${err.status} ${err.code}`
                          : String(err),
                      );
                      await refresh();
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Workouts">
        {workouts.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {workouts.map((w) => (
              <li
                key={w.id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{w.description}</span>
                    <span className="font-mono text-xs text-zinc-500">
                      {formatTime(w.performedAt)}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-zinc-500 tabular-nums">
                    {Math.round(w.caloriesBurned)} kcal burned
                    {w.durationMinutes !== null &&
                      ` · ${w.durationMinutes} min`}
                  </div>
                </div>
                <DeleteButton
                  onConfirm={async () => {
                    setWorkouts((xs) => xs.filter((x) => x.id !== w.id));
                    try {
                      await api.deleteWorkout(w.id);
                    } catch (err) {
                      console.error("deleteWorkout failed", err);
                      setError(
                        err instanceof ApiError
                          ? `delete workout: ${err.status} ${err.code}`
                          : String(err),
                      );
                      await refresh();
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function sumMacros(meals: Meal[]): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function TotalsBar({
  totals,
  caloriesBurned,
  targets,
}: {
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
  caloriesBurned: number;
  targets: ReturnType<typeof effectiveTargets> | null;
}) {
  const remaining =
    targets && targets.calories !== null
      ? targets.calories - totals.calories + caloriesBurned
      : null;
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-2 rounded-md border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm tabular-nums dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4">
      <Stat
        label="Eaten"
        value={Math.round(totals.calories)}
        suffix="kcal"
        accent
      />
      <Stat
        label="Burned"
        value={Math.round(caloriesBurned)}
        suffix="kcal"
      />
      <Stat
        label="Remaining"
        value={remaining === null ? "—" : Math.round(remaining)}
        suffix="kcal"
      />
      <Stat
        label="Protein"
        value={`${Math.round(totals.proteinG)}/${
          targets?.proteinG !== null && targets?.proteinG !== undefined
            ? targets.proteinG
            : "—"
        }`}
        suffix="g"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div
        className={
          accent
            ? "mt-1 text-xl font-semibold text-[color:var(--color-accent)]"
            : "mt-1 text-xl font-semibold"
        }
      >
        {value}
        {suffix && (
          <span className="ml-1 text-xs font-normal text-zinc-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700">
      {children}
    </p>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
      aria-label="Delete"
    >
      ✕
    </button>
  );
}

function MealForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createMeal({
        description: description.trim(),
        calories: Number(calories) || 0,
        proteinG: Number(proteinG) || 0,
        carbsG: Number(carbsG) || 0,
        fatG: Number(fatG) || 0,
      });
      setDescription("");
      setCalories("");
      setProteinG("");
      setCarbsG("");
      setFatG("");
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Log a meal
      </h3>
      <input
        required
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. chicken burrito bowl"
        className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="mt-2 grid grid-cols-4 gap-2">
        <NumInput value={calories} onChange={setCalories} placeholder="kcal" />
        <NumInput value={proteinG} onChange={setProteinG} placeholder="P g" />
        <NumInput value={carbsG} onChange={setCarbsG} placeholder="C g" />
        <NumInput value={fatG} onChange={setFatG} placeholder="F g" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !description.trim()}
          className="rounded-md bg-[color:var(--color-accent)] px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)] disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add meal"}
        </button>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

function WorkoutForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [description, setDescription] = useState("");
  const [caloriesBurned, setCaloriesBurned] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createWorkout({
        description: description.trim(),
        caloriesBurned: Number(caloriesBurned) || 0,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
      });
      setDescription("");
      setCaloriesBurned("");
      setDurationMinutes("");
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Log a workout
      </h3>
      <input
        required
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. 5 mile run"
        className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <NumInput
          value={caloriesBurned}
          onChange={setCaloriesBurned}
          placeholder="kcal burned"
        />
        <NumInput
          value={durationMinutes}
          onChange={setDurationMinutes}
          placeholder="min"
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !description.trim()}
          className="rounded-md bg-[color:var(--color-accent)] px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)] disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add workout"}
        </button>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
    />
  );
}

function Centered({
  children,
  muted,
  danger,
}: {
  children: React.ReactNode;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center px-6">
      <p
        className={
          danger
            ? "text-red-600 dark:text-red-400"
            : muted
              ? "text-zinc-500"
              : ""
        }
      >
        {children}
      </p>
    </main>
  );
}
