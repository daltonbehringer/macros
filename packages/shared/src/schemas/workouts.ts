import { z } from "zod";

export const Workout = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  performed_at: z.string().datetime(),
  description: z.string(),
  calories_burned: z.number().nonnegative(),
  duration_minutes: z.number().nonnegative().nullable(),
  created_at: z.string().datetime(),
});
export type Workout = z.infer<typeof Workout>;

export const CreateWorkout = Workout.omit({
  id: true,
  user_id: true,
  created_at: true,
}).extend({
  performed_at: z.string().datetime().optional(),
  duration_minutes: z.number().nonnegative().nullable().optional(),
});
export type CreateWorkout = z.infer<typeof CreateWorkout>;
