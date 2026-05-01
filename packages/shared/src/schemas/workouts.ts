import { z } from "zod";

export const Workout = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  performedAt: z.string().datetime(),
  description: z.string(),
  caloriesBurned: z.number().nonnegative(),
  durationMinutes: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
});
export type Workout = z.infer<typeof Workout>;

export const CreateWorkoutInput = z.object({
  description: z.string().min(1).max(500),
  caloriesBurned: z.number().nonnegative(),
  durationMinutes: z.number().int().nonnegative().nullable().optional(),
  performedAt: z.string().datetime().optional(),
});
export type CreateWorkoutInput = z.infer<typeof CreateWorkoutInput>;
