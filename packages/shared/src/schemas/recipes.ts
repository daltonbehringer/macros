import { z } from "zod";

export const RecipeIngredient = z.object({
  name: z.string(),
  quantity: z.string(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredient>;

export const Recipe = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  ingredients: z.array(RecipeIngredient),
  caloriesPerServing: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  servings: z.number().positive(),
  createdBy: z.enum(["user", "llm"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Recipe = z.infer<typeof Recipe>;

export const CreateRecipeInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  ingredients: z.array(RecipeIngredient).optional(),
  caloriesPerServing: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  servings: z.number().positive().default(1),
});
export type CreateRecipeInput = z.infer<typeof CreateRecipeInput>;

export const UpdateRecipeInput = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  ingredients: z.array(RecipeIngredient).optional(),
  caloriesPerServing: z.number().nonnegative().optional(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  servings: z.number().positive().optional(),
});
export type UpdateRecipeInput = z.infer<typeof UpdateRecipeInput>;
