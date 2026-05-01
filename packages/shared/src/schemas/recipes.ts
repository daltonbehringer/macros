import { z } from "zod";

export const RecipeIngredient = z.object({
  name: z.string(),
  quantity: z.string(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredient>;

export const Recipe = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  ingredients: z.array(RecipeIngredient),
  calories_per_serving: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  servings: z.number().positive(),
  created_by: z.enum(["user", "llm"]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Recipe = z.infer<typeof Recipe>;

export const CreateRecipe = Recipe.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
});
export type CreateRecipe = z.infer<typeof CreateRecipe>;
