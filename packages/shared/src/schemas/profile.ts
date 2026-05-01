import { z } from "zod";

export const ActivityLevel = z.enum([
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]);
export type ActivityLevel = z.infer<typeof ActivityLevel>;

export const Sex = z.enum(["male", "female"]);
export type Sex = z.infer<typeof Sex>;

export const UnitSystem = z.enum(["metric", "imperial"]);
export type UnitSystem = z.infer<typeof UnitSystem>;

export const UserProfile = z.object({
  userId: z.string().uuid(),
  heightCm: z.number().positive().nullable(),
  weightKg: z.number().positive().nullable(),
  age: z.number().int().positive().nullable(),
  sex: Sex.nullable(),
  activityLevel: ActivityLevel.nullable(),
  unitSystem: UnitSystem,
  timezone: z.string(),
  // Targets — null means use computed defaults derived from the body fields above.
  dailyCalorieTarget: z.number().positive().nullable(),
  dailyProteinG: z.number().nonnegative().nullable(),
  dailyCarbsG: z.number().nonnegative().nullable(),
  dailyFatG: z.number().nonnegative().nullable(),
});
export type UserProfile = z.infer<typeof UserProfile>;

/**
 * PATCH-shaped profile update. Every field is optional; missing fields are
 * left untouched server-side. Defaults are intentionally not applied here so
 * the API doesn't silently overwrite existing values.
 */
export const UpdateUserProfile = z.object({
  heightCm: z.number().positive().nullable().optional(),
  weightKg: z.number().positive().nullable().optional(),
  age: z.number().int().positive().nullable().optional(),
  sex: Sex.nullable().optional(),
  activityLevel: ActivityLevel.nullable().optional(),
  unitSystem: UnitSystem.optional(),
  timezone: z.string().optional(),
  dailyCalorieTarget: z.number().positive().nullable().optional(),
  dailyProteinG: z.number().nonnegative().nullable().optional(),
  dailyCarbsG: z.number().nonnegative().nullable().optional(),
  dailyFatG: z.number().nonnegative().nullable().optional(),
});
export type UpdateUserProfile = z.infer<typeof UpdateUserProfile>;
