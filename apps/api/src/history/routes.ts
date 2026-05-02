import { forUser, schema } from "@macros/db";
import { effectiveTargets } from "@macros/shared";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { getDb } from "../db";

const HistoryQuery = z.object({
  /** YYYY-MM-DD inclusive (in user's local TZ). */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** YYYY-MM-DD inclusive (in user's local TZ). */
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** IANA timezone — defaults to user's profile.timezone. */
  timezone: z.string().min(1).max(100).optional(),
});

const MAX_RANGE_DAYS = 366;

export const historyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/history", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = HistoryQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_query" });
      return;
    }
    const { from, to } = parsed.data;
    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T00:00:00Z`);
    if (toDate < fromDate) {
      reply.code(400).send({ error: "to_before_from" });
      return;
    }
    const dayCount =
      Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (dayCount > MAX_RANGE_DAYS) {
      reply.code(400).send({ error: "range_too_large" });
      return;
    }

    const user = req.user!;
    const { db } = getDb();

    // Resolve timezone: explicit query param wins, else profile, else UTC.
    // Validate against Intl — invalid values silently fall back to UTC. This
    // matters because we have to inline the tz string into the SQL (Drizzle
    // would otherwise issue two distinct $N parameters for the same value
    // and Postgres rejects the GROUP BY as not matching the SELECT).
    let tz = parsed.data.timezone ?? "UTC";
    const profile = await forUser(db, user.id, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, user.id))
        .limit(1);
      return rows[0] ?? null;
    });
    if (!parsed.data.timezone && profile?.timezone) tz = profile.timezone;
    if (!isValidTimezone(tz)) tz = "UTC";

    // UTC bounds that conservatively cover the requested local-date range.
    // We pad by ±1 day so a meal at the local-day edge doesn't miss; the
    // grouping below normalizes to the user's local date.
    const utcStart = new Date(fromDate);
    utcStart.setUTCDate(utcStart.getUTCDate() - 1);
    const utcEnd = new Date(toDate);
    utcEnd.setUTCDate(utcEnd.getUTCDate() + 2);

    type DayRow = {
      day: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
    type BurnRow = { day: string; calories_burned: number };

    // tz is validated above — safe to inline. Drizzle's sql.raw skips
    // parameter binding so SELECT and GROUP BY render the identical expression.
    const tzLiteral = sql.raw(`'${tz}'`);

    const { mealRows, workoutRows } = await forUser(db, user.id, async (tx) => {
      const dayMeal = sql<string>`((${schema.meals.consumedAt}) AT TIME ZONE ${tzLiteral})::date::text`;
      const mealRows = (await tx
        .select({
          day: dayMeal,
          calories: sql<number>`coalesce(sum(${schema.meals.calories}), 0)`,
          protein_g: sql<number>`coalesce(sum(${schema.meals.proteinG}), 0)`,
          carbs_g: sql<number>`coalesce(sum(${schema.meals.carbsG}), 0)`,
          fat_g: sql<number>`coalesce(sum(${schema.meals.fatG}), 0)`,
        })
        .from(schema.meals)
        .where(
          and(
            gte(schema.meals.consumedAt, utcStart),
            lt(schema.meals.consumedAt, utcEnd),
          ),
        )
        .groupBy(dayMeal)) as DayRow[];

      const dayWorkout = sql<string>`((${schema.workouts.performedAt}) AT TIME ZONE ${tzLiteral})::date::text`;
      const workoutRows = (await tx
        .select({
          day: dayWorkout,
          calories_burned: sql<number>`coalesce(sum(${schema.workouts.caloriesBurned}), 0)`,
        })
        .from(schema.workouts)
        .where(
          and(
            gte(schema.workouts.performedAt, utcStart),
            lt(schema.workouts.performedAt, utcEnd),
          ),
        )
        .groupBy(dayWorkout)) as BurnRow[];

      return { mealRows, workoutRows };
    });

    const mealsByDay = new Map(mealRows.map((r) => [r.day, r]));
    const workoutsByDay = new Map(workoutRows.map((r) => [r.day, r]));

    const days: Array<{
      date: string;
      caloriesConsumed: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      caloriesBurned: number;
    }> = [];
    const cursor = new Date(fromDate);
    while (cursor <= toDate) {
      const date = cursor.toISOString().slice(0, 10);
      const m = mealsByDay.get(date);
      const w = workoutsByDay.get(date);
      days.push({
        date,
        caloriesConsumed: Number(m?.calories ?? 0),
        proteinG: Number(m?.protein_g ?? 0),
        carbsG: Number(m?.carbs_g ?? 0),
        fatG: Number(m?.fat_g ?? 0),
        caloriesBurned: Number(w?.calories_burned ?? 0),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const baseTargets = profile ? effectiveTargets(profile) : null;

    return {
      from,
      to,
      timezone: tz,
      targets: baseTargets
        ? {
            calories: baseTargets.calories,
            proteinG: baseTargets.proteinG,
            carbsG: baseTargets.carbsG,
            fatG: baseTargets.fatG,
            tdeeKcal: baseTargets.tdeeKcal,
          }
        : null,
      days,
    };
  });
};

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
