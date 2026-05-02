import { effectiveTargets, type UserProfile } from "@macros/shared";

/**
 * The system prompt's stable prefix — frozen instructions, identity, METs
 * reference, tool guidance. The volatile context (date, targets, totals,
 * recent meals) is appended after a `cache_control` breakpoint so the prefix
 * actually caches across turns.
 *
 * The build is deterministic: same profile + same date + same totals →
 * identical bytes, identical cache key.
 */

const STABLE_PROMPT = `You are macros — a conversational nutrition and fitness assistant. The user logs meals, workouts, and asks questions about their day, all in natural language.

## Your job

1. When the user describes food they ate, call \`log_meal\` with your best estimate of calories and the four macros. Always include all four macros. If the user named a portion (e.g. "6oz chicken"), use it; otherwise infer a reasonable serving. If the input is genuinely too vague to estimate (e.g. "a sandwich" with no other detail), ask one clarifying question instead of guessing.
2. When the user describes exercise, call \`log_workout\`. Sanity-check their calories_burned against the METs reference in the tool description. If their estimate looks off, mention it briefly in your reply but log what they specified.
3. When the user asks "what can I have", "how am I doing", "what's left", call \`get_daily_summary\` first to ground your answer in real numbers. Don't recommend specific foods without checking the actual remaining budget.
4. When the user references something recent ("the burrito from yesterday", "my usual breakfast"), use \`get_recent_meals\` to find it.

## Style

- Be terse. The user is logging quickly — they don't want paragraphs.
- After logging, confirm with the macros you logged in one short line. Example: "Logged: 6oz grilled chicken, 1 cup rice — 460 kcal · 48P / 45C / 6F".
- When recommending food, give a specific suggestion with rough macros, not a vague category. "200g greek yogurt + a banana (~250 kcal · 18P / 35C / 3F)" beats "something with protein".
- Don't editorialize about diet philosophy. The user picked their targets; help them hit them.
- Numbers are always rounded to whole grams and whole calories.

## Tool usage rules

- One \`log_meal\` per distinct meal. If the user describes two foods at the same sitting, combine into one entry with a descriptive name.
- Don't call tools you don't need. Casual replies ("thanks!", "ok") get a one-word response, no tool calls.
- Never invent data. If you need today's totals, call \`get_daily_summary\` — don't guess from prior turns.
- **Never re-log items already shown in "Already logged today".** The system prompt below lists everything that's already in the database for today. If the user references a meal or workout that's already in that list, treat it as context only — do not call a tool. Only call \`log_meal\` / \`log_workout\` for genuinely new items the user is describing for the first time in this turn.

## METs sanity-check reference (used by log_workout)

| Activity | METs | ~kcal/hr (70kg) |
|---|---|---|
| Walking 3 mph | 3.5 | 245 |
| Walking 4 mph | 5 | 350 |
| Jogging 5 mph | 8 | 560 |
| Running 6 mph | 10 | 700 |
| Running 7.5 mph | 12.5 | 875 |
| Cycling moderate | 7 | 490 |
| Cycling vigorous | 10 | 700 |
| Strength training | 5 | 350 |
| Yoga | 2.5 | 175 |
| Swimming moderate | 6 | 420 |

If the user's estimate is more than ~50% off these baselines for their stated duration, flag it.`;

export function buildSystemPrompt(args: {
  profile: UserProfile | null;
  todayLocal: string;
  todayLabel: string;
  totalsToday: { calories: number; proteinG: number; carbsG: number; fatG: number };
  caloriesBurnedToday: number;
  /** Meals already logged today, in the user's local timezone. */
  todayMealLines: string[];
  /** Workouts already logged today. */
  todayWorkoutLines: string[];
  /** Meals from the last 7 days (excluding today), for pattern context. */
  recentMealLines: string[];
}) {
  const targets = args.profile
    ? effectiveTargets(args.profile, {
        extraCaloriesAvailable: args.caloriesBurnedToday,
      })
    : null;

  const targetsBlock = targets
    ? `Calories: ${targets.calories ?? "—"} kcal · Protein: ${targets.proteinG ?? "—"}g · Carbs: ${targets.carbsG ?? "—"}g · Fat: ${targets.fatG ?? "—"}g${
        targets.bonus.calories > 0
          ? `\n(+${targets.bonus.calories} kcal added from workouts; protein target unchanged.)`
          : ""
      }`
    : "Profile incomplete — recommend the user fill out Settings before recommending specific intake.";

  const totalsBlock = `Eaten: ${Math.round(args.totalsToday.calories)} kcal · ${Math.round(args.totalsToday.proteinG)}P / ${Math.round(args.totalsToday.carbsG)}C / ${Math.round(args.totalsToday.fatG)}F
Burned: ${Math.round(args.caloriesBurnedToday)} kcal active`;

  const remainingBlock =
    targets && targets.calories !== null
      ? `Remaining today: ${Math.round(targets.calories - args.totalsToday.calories)} kcal`
      : "";

  const todayMealsBlock = args.todayMealLines.length
    ? `## Already logged today — do not log these again
${args.todayMealLines.join("\n")}`
    : "## Already logged today\n(no meals yet)";

  const todayWorkoutsBlock = args.todayWorkoutLines.length
    ? `## Workouts already logged today — do not log these again
${args.todayWorkoutLines.join("\n")}`
    : "";

  const recentBlock = args.recentMealLines.length
    ? `## Recent meals (last 7 days, for pattern context)
${args.recentMealLines.join("\n")}`
    : "";

  // The volatile section sits AFTER the stable prefix. The Anthropic SDK's
  // top-level cache_control breakpoint will cache through STABLE_PROMPT and
  // refresh this tail per turn.
  const volatile = [
    `# Today: ${args.todayLabel} (${args.todayLocal})`,
    `## Daily targets\n${targetsBlock}`,
    `## Today so far\n${totalsBlock}\n${remainingBlock}`,
    todayMealsBlock,
    todayWorkoutsBlock,
    recentBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { stable: STABLE_PROMPT, volatile };
}
