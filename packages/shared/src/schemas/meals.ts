import { z } from "zod";

export const MealSource = z.enum(["llm_parsed", "manual", "recipe"]);
export type MealSource = z.infer<typeof MealSource>;

export const Meal = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  consumedAt: z.string().datetime(),
  description: z.string(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  source: MealSource,
  recipeId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type Meal = z.infer<typeof Meal>;

/** What the manual-entry POST /meals body accepts. */
export const CreateMealInput = z.object({
  description: z.string().min(1).max(500),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  consumedAt: z.string().datetime().optional(),
});
export type CreateMealInput = z.infer<typeof CreateMealInput>;
