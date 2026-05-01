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
  height_cm: z.number().positive().nullable(),
  weight_kg: z.number().positive().nullable(),
  age: z.number().int().positive().nullable(),
  sex: Sex.nullable(),
  activity_level: ActivityLevel.nullable(),
  unit_system: UnitSystem.default("imperial"),
  // Targets — null means use computed defaults
  daily_calorie_target: z.number().positive().nullable(),
  daily_protein_g: z.number().nonnegative().nullable(),
  daily_carbs_g: z.number().nonnegative().nullable(),
  daily_fat_g: z.number().nonnegative().nullable(),
  timezone: z.string().default("UTC"),
});
export type UserProfile = z.infer<typeof UserProfile>;

export const UpdateUserProfile = UserProfile.partial();
export type UpdateUserProfile = z.infer<typeof UpdateUserProfile>;
