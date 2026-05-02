"use client";

import { effectiveTargets, type Meal, type Workout } from "@macros/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { MacroRing } from "@/components/MacroRing";
import { QuickChatInput } from "@/components/QuickChatInput";
import { api, ApiError, type Me } from "@/lib/api";
import { todayRange } from "@/lib/dates";

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLogForms, setShowLogForms] = useState(false);
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

  if (error)
    return (
      <Centered>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </Centered>
    );
  if (!me)
    return (
      <Centered>
        <p className="text-zinc-500">Loading…</p>
      </Centered>
    );

  const totals = sumMacros(meals);
  const caloriesBurned = workouts.reduce((s, w) => s + w.caloriesBurned, 0);
  const targets = me.profile
    ? effectiveTargets(me.profile, { extraCaloriesAvailable: caloriesBurned })
    : null;
  const remaining =
    targets && targets.calories !== null
      ? targets.calories - totals.calories
      : null;

  const deleteMeal = async (id: string) => {
    setMeals((xs) => xs.filter((x) => x.id !== id));
    try {
      await api.deleteMeal(id);
    } catch (err) {
      console.error("deleteMeal failed", err);
      await refresh();
    }
  };
  const deleteWorkout = async (id: string) => {
    setWorkouts((xs) => xs.filter((x) => x.id !== id));
    try {
      await api.deleteWorkout(id);
    } catch (err) {
      console.error("deleteWorkout failed", err);
      await refresh();
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 pb-24 md:py-10 md:pb-10">
      <header className="mb-8 flex items-center justify-between md:mb-10">
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-zinc-500"
        >
          macros
        </a>
        <div className="hidden items-center gap-3 text-sm md:flex">
          <span className="text-zinc-500">{me.user.email}</span>
          <a
            href="/history"
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            History
          </a>
          <a
            href="/recipes"
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Recipes
          </a>
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
        <a
          href="/settings"
          className="text-xs text-zinc-500 md:hidden"
          aria-label="Settings"
        >
          {me.user.email}
        </a>
      </header>

      <section className="mb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          {new Date().toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-2 flex items-baseline gap-3 text-5xl font-semibold tracking-tight tabular-nums">
          {remaining === null ? (
            <span className="text-zinc-300 dark:text-zinc-700">—</span>
          ) : (
            <span
              className={
                remaining < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-[color:var(--color-accent)]"
              }
            >
              {Math.round(remaining)}
            </span>
          )}
          <span className="text-base font-normal text-zinc-500">
            kcal {remaining !== null && remaining < 0 ? "over" : "remaining"}
          </span>
        </h1>
        {targets === null || targets.calories === null ? (
          <p className="mt-3 text-sm text-zinc-500">
            Set your profile in{" "}
            <a
              href="/settings"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              Settings
            </a>{" "}
            to see your targets.
          </p>
        ) : null}
      </section>

      <section className="mb-12 grid grid-cols-2 gap-y-8 sm:grid-cols-4">
        <MacroRing
          label="Calories"
          unit="kcal"
          value={totals.calories}
          target={targets?.calories ?? null}
          accent
        />
        <MacroRing
          label="Protein"
          unit="g"
          value={totals.proteinG}
          target={targets?.proteinG ?? null}
        />
        <MacroRing
          label="Carbs"
          unit="g"
          value={totals.carbsG}
          target={targets?.carbsG ?? null}
        />
        <MacroRing
          label="Fat"
          unit="g"
          value={totals.fatG}
          target={targets?.fatG ?? null}
        />
      </section>

      <section className="mb-10">
        <QuickChatInput onAfterReply={refresh} />
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Activity
          </h2>
          <span className="font-mono text-xs text-zinc-400 tabular-nums">
            {meals.length + workouts.length} entries · {Math.round(totals.calories)} in · {Math.round(caloriesBurned)} out
          </span>
        </div>
        <ActivityFeed
          meals={meals}
          workouts={workouts}
          onDeleteMeal={deleteMeal}
          onDeleteWorkout={deleteWorkout}
        />
      </section>

      <section className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setShowLogForms((s) => !s)}
          className="text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {showLogForms ? "Hide" : "+ Log manually"}
        </button>
        {showLogForms && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MealForm onCreated={refresh} />
            <WorkoutForm onCreated={refresh} />
          </div>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------

function sumMacros(meals: Meal[]) {
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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center px-6">
      {children}
    </main>
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
    <form
      onSubmit={onSubmit}
      className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Meal
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
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
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
    <form
      onSubmit={onSubmit}
      className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Workout
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
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
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
