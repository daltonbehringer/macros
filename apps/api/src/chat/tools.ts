import type Anthropic from "@anthropic-ai/sdk";
import { forUser, schema, type DbHandle } from "@macros/db";
import { and, desc, gte, lt } from "drizzle-orm";
import { z } from "zod";

/**
 * Tool definitions sent to Claude in the `tools` array, plus typed input
 * schemas (zod) and executors. Each executor runs server-side under the
 * authenticated user's RLS context — the LLM never sees raw rows beyond what
 * we choose to return.
 */

export type ToolContext = {
  userId: string;
  /** Browser-local "today" as YYYY-MM-DD. */
  todayLocal: string;
  /** ISO start of "today" in UTC, derived from todayLocal + tz on the client. */
  dayStartUtc: string;
  dayEndUtc: string;
  db: DbHandle["db"];
};

const LogMealInput = z.object({
  description: z.string().min(1).max(500),
  calories: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  consumed_at: z.string().datetime().optional(),
});

const LogWorkoutInput = z.object({
  description: z.string().min(1).max(500),
  calories_burned: z.number().nonnegative(),
  duration_minutes: z.number().int().nonnegative().optional(),
  performed_at: z.string().datetime().optional(),
});

const GetDailySummaryInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const GetRecentMealsInput = z.object({
  days: z.number().int().min(1).max(14).default(3),
});

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "log_meal",
    description:
      "Log a meal the user just ate (or recently ate). Estimate calories and macros from the description and serving size; reuse the user's stated portion when given. Always include all four macros and a complete description that names the food and portion.",
    input_schema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description:
            "What the user ate, including portion. e.g. '6oz grilled chicken breast with 1 cup white rice'.",
        },
        calories: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
        consumed_at: {
          type: "string",
          description:
            "ISO 8601 datetime in UTC. Defaults to now if omitted. Use this only when the user said a time other than 'now'.",
        },
      },
      required: ["description", "calories", "protein_g", "carbs_g", "fat_g"],
    },
  },
  {
    name: "log_workout",
    description:
      "Log a workout the user did. If the user's stated calories_burned looks wildly off vs. typical METs (e.g. >800 kcal for a 30-min walk), include a brief sanity-check note in your reply but still log what they asked for. Reasonable METs reference: walking 3 mph ~3.5 METs (~250 kcal/hr for 70kg), running 6 mph ~10 METs (~700 kcal/hr), cycling moderate ~7 METs (~500 kcal/hr), strength training ~5 METs (~350 kcal/hr).",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        calories_burned: { type: "number" },
        duration_minutes: { type: "integer" },
        performed_at: { type: "string" },
      },
      required: ["description", "calories_burned"],
    },
  },
  {
    name: "get_daily_summary",
    description:
      "Get the user's totals for a date: calories consumed, calories burned, macro totals, and remaining budget. Call this when the user asks how they're tracking, what they have room for, or when you need today's numbers to make a recommendation.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "YYYY-MM-DD in the user's local timezone. Defaults to today if omitted.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_recent_meals",
    description:
      "Get the user's meals from the last N days as JSON. Useful for spotting patterns ('you've had pasta four nights this week') or for context when the user references something they ate recently.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "1–14, default 3." },
      },
      required: [],
    },
  },
];

type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

/**
 * Execute a tool call. Returns a JSON-serializable result that goes back to
 * Claude as `tool_result` content. Errors return `is_error: true` upstream.
 */
export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "log_meal":
        return { ok: true, data: await logMeal(LogMealInput.parse(input), ctx) };
      case "log_workout":
        return {
          ok: true,
          data: await logWorkout(LogWorkoutInput.parse(input), ctx),
        };
      case "get_daily_summary":
        return {
          ok: true,
          data: await getDailySummary(GetDailySummaryInput.parse(input), ctx),
        };
      case "get_recent_meals":
        return {
          ok: true,
          data: await getRecentMeals(GetRecentMealsInput.parse(input), ctx),
        };
      default:
        return { ok: false, error: `unknown tool: ${name}` };
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: `invalid input: ${err.message}` };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "tool execution failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function logMeal(input: z.infer<typeof LogMealInput>, ctx: ToolContext) {
  return forUser(ctx.db, ctx.userId, async (tx) => {
    const inserted = await tx
      .insert(schema.meals)
      .values({
        userId: ctx.userId,
        description: input.description,
        calories: input.calories,
        proteinG: input.protein_g,
        carbsG: input.carbs_g,
        fatG: input.fat_g,
        consumedAt: input.consumed_at ? new Date(input.consumed_at) : new Date(),
        source: "llm_parsed",
      })
      .returning();
    return inserted[0];
  });
}

async function logWorkout(
  input: z.infer<typeof LogWorkoutInput>,
  ctx: ToolContext,
) {
  return forUser(ctx.db, ctx.userId, async (tx) => {
    const inserted = await tx
      .insert(schema.workouts)
      .values({
        userId: ctx.userId,
        description: input.description,
        caloriesBurned: input.calories_burned,
        durationMinutes: input.duration_minutes ?? null,
        performedAt: input.performed_at
          ? new Date(input.performed_at)
          : new Date(),
      })
      .returning();
    return inserted[0];
  });
}

async function getDailySummary(
  input: z.infer<typeof GetDailySummaryInput>,
  ctx: ToolContext,
) {
  // For "today" we have pre-computed UTC bounds from the request. For other
  // dates the LLM passed a YYYY-MM-DD string; treat it as UTC midnight which
  // is fine for a coarse daily summary.
  const useToday = !input.date || input.date === ctx.todayLocal;
  const start = useToday ? new Date(ctx.dayStartUtc) : new Date(`${input.date}T00:00:00Z`);
  const end = useToday
    ? new Date(ctx.dayEndUtc)
    : new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return forUser(ctx.db, ctx.userId, async (tx) => {
    const meals = await tx
      .select()
      .from(schema.meals)
      .where(
        and(
          gte(schema.meals.consumedAt, start),
          lt(schema.meals.consumedAt, end),
        ),
      );
    const workouts = await tx
      .select()
      .from(schema.workouts)
      .where(
        and(
          gte(schema.workouts.performedAt, start),
          lt(schema.workouts.performedAt, end),
        ),
      );
    const totals = meals.reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        protein_g: a.protein_g + m.proteinG,
        carbs_g: a.carbs_g + m.carbsG,
        fat_g: a.fat_g + m.fatG,
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
    const calories_burned = workouts.reduce((a, w) => a + w.caloriesBurned, 0);
    return {
      date: input.date ?? ctx.todayLocal,
      meals_count: meals.length,
      workouts_count: workouts.length,
      totals,
      calories_burned,
    };
  });
}

async function getRecentMeals(
  input: z.infer<typeof GetRecentMealsInput>,
  ctx: ToolContext,
) {
  const start = new Date(ctx.dayStartUtc);
  start.setUTCDate(start.getUTCDate() - input.days);
  return forUser(ctx.db, ctx.userId, async (tx) => {
    const rows = await tx
      .select({
        consumed_at: schema.meals.consumedAt,
        description: schema.meals.description,
        calories: schema.meals.calories,
        protein_g: schema.meals.proteinG,
        carbs_g: schema.meals.carbsG,
        fat_g: schema.meals.fatG,
      })
      .from(schema.meals)
      .where(gte(schema.meals.consumedAt, start))
      .orderBy(desc(schema.meals.consumedAt))
      .limit(50);
    return { days: input.days, meals: rows };
  });
}

