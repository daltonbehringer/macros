import { z } from "zod";

export const MealSource = z.enum(["llm_parsed", "manual", "recipe"]);
export type MealSource = z.infer<typeof MealSource>;

export const Meal = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  consumed_at: z.string().datetime(),
  description: z.string(),
  calories: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  source: MealSource,
  recipe_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
});
export type Meal = z.infer<typeof Meal>;

export const CreateMeal = Meal.omit({
  id: true,
  user_id: true,
  created_at: true,
}).extend({
  consumed_at: z.string().datetime().optional(),
  source: MealSource.default("manual"),
  recipe_id: z.string().uuid().nullable().optional(),
});
export type CreateMeal = z.infer<typeof CreateMeal>;
