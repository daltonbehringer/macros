import type { ActivityLevel, Sex } from "./schemas/profile";

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}
export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}
export function inchToCm(inch: number): number {
  return inch * CM_PER_INCH;
}
export function cmToInch(cm: number): number {
  return cm / CM_PER_INCH;
}

/** Mifflin-St Jeor BMR. */
export function bmr(args: {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: Sex;
}): number {
  const base = 10 * args.weight_kg + 6.25 * args.height_cm - 5 * args.age;
  return args.sex === "male" ? base + 5 : base - 161;
}

export function tdee(args: {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: Sex;
  activity_level: ActivityLevel;
}): number {
  return bmr(args) * ACTIVITY_MULTIPLIER[args.activity_level];
}

/**
 * Default macro split: protein 0.8 g/lb bodyweight, fat 25% of TDEE,
 * carbs fill the remainder. User overrides take precedence over these.
 */
export function defaultMacroTargets(args: {
  weight_kg: number;
  tdee_kcal: number;
}): {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} {
  const protein_g = Math.round(0.8 * kgToLb(args.weight_kg));
  const fat_kcal = 0.25 * args.tdee_kcal;
  const fat_g = Math.round(fat_kcal / 9);
  const remaining_kcal = args.tdee_kcal - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(0, Math.round(remaining_kcal / 4));
  return {
    calories: Math.round(args.tdee_kcal),
    protein_g,
    carbs_g,
    fat_g,
  };
}
