"use client";

import type { Meal, Workout } from "@macros/shared";
import { useState } from "react";
import { formatTime } from "@/lib/dates";

type Item =
  | { kind: "meal"; at: string; meal: Meal }
  | { kind: "workout"; at: string; workout: Workout };

export function ActivityFeed({
  meals,
  workouts,
  onDeleteMeal,
  onDeleteWorkout,
}: {
  meals: Meal[];
  workouts: Workout[];
  onDeleteMeal: (id: string) => Promise<void>;
  onDeleteWorkout: (id: string) => Promise<void>;
}) {
  const items: Item[] = [
    ...meals.map((m): Item => ({ kind: "meal", at: m.consumedAt, meal: m })),
    ...workouts.map(
      (w): Item => ({ kind: "workout", at: w.performedAt, workout: w }),
    ),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Nothing logged yet today.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {items.map((it) =>
        it.kind === "meal" ? (
          <MealRow key={it.meal.id} meal={it.meal} onDelete={onDeleteMeal} />
        ) : (
          <WorkoutRow
            key={it.workout.id}
            workout={it.workout}
            onDelete={onDeleteWorkout}
          />
        ),
      )}
    </ul>
  );
}

function Row({
  time,
  marker,
  title,
  detail,
  onDelete,
}: {
  time: string;
  marker: React.ReactNode;
  title: string;
  detail: string;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex items-start gap-4 py-3">
      <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-zinc-500 tabular-nums">
        {time}
      </span>
      <span className="pt-1.5">{marker}</span>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{title}</div>
        <div className="mt-0.5 font-mono text-xs text-zinc-500 tabular-nums">
          {detail}
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onDelete();
          } finally {
            setBusy(false);
          }
        }}
        className="text-xs text-zinc-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 focus:opacity-100 disabled:opacity-30 dark:hover:text-red-400"
        aria-label="Delete"
      >
        ✕
      </button>
    </li>
  );
}

function MealRow({
  meal,
  onDelete,
}: {
  meal: Meal;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="group">
      <Row
        time={formatTime(meal.consumedAt)}
        marker={
          <span className="block h-2 w-2 rounded-full bg-[color:var(--color-accent)]" />
        }
        title={meal.description}
        detail={`${Math.round(meal.calories)} kcal · P ${meal.proteinG}g · C ${meal.carbsG}g · F ${meal.fatG}g`}
        onDelete={() => onDelete(meal.id)}
      />
    </div>
  );
}

function WorkoutRow({
  workout,
  onDelete,
}: {
  workout: Workout;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="group">
      <Row
        time={formatTime(workout.performedAt)}
        marker={
          <span className="block h-2 w-2 rounded-full border border-zinc-400 dark:border-zinc-500" />
        }
        title={workout.description}
        detail={`−${Math.round(workout.caloriesBurned)} kcal${
          workout.durationMinutes !== null
            ? ` · ${workout.durationMinutes} min`
            : ""
        }`}
        onDelete={() => onDelete(workout.id)}
      />
    </div>
  );
}
