import type { ActivityLevel, Sex, UserProfile } from "./schemas/profile";

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

/** Mifflin-St Jeor BMR (kcal/day). */
export function bmr(args: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}): number {
  const base = 10 * args.weightKg + 6.25 * args.heightCm - 5 * args.age;
  return args.sex === "male" ? base + 5 : base - 161;
}

export function tdee(args: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
}): number {
  return bmr(args) * ACTIVITY_MULTIPLIER[args.activityLevel];
}

export type ComputedTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/**
 * Default macro split: protein 0.8 g/lb bodyweight, fat 25% of TDEE,
 * carbs fill the remainder. User overrides take precedence over these.
 */
export function defaultMacroTargets(args: {
  weightKg: number;
  tdeeKcal: number;
}): ComputedTargets {
  const proteinG = Math.round(0.8 * kgToLb(args.weightKg));
  const fatKcal = 0.25 * args.tdeeKcal;
  const fatG = Math.round(fatKcal / 9);
  const remainingKcal = args.tdeeKcal - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(remainingKcal / 4));
  return {
    calories: Math.round(args.tdeeKcal),
    proteinG,
    carbsG,
    fatG,
  };
}

/**
 * Effective targets for a user: returns null for any macro that can't be
 * computed yet (profile incomplete) and isn't overridden. Otherwise overrides
 * win, then computed defaults fill in the rest.
 */
export function effectiveTargets(profile: UserProfile): {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  computed: ComputedTargets | null;
  tdeeKcal: number | null;
} {
  const canCompute =
    profile.weightKg !== null &&
    profile.heightCm !== null &&
    profile.age !== null &&
    profile.sex !== null &&
    profile.activityLevel !== null;

  let computed: ComputedTargets | null = null;
  let tdeeKcal: number | null = null;
  if (canCompute) {
    tdeeKcal = tdee({
      weightKg: profile.weightKg!,
      heightCm: profile.heightCm!,
      age: profile.age!,
      sex: profile.sex!,
      activityLevel: profile.activityLevel!,
    });
    computed = defaultMacroTargets({
      weightKg: profile.weightKg!,
      tdeeKcal,
    });
  }

  return {
    calories: profile.dailyCalorieTarget ?? computed?.calories ?? null,
    proteinG: profile.dailyProteinG ?? computed?.proteinG ?? null,
    carbsG: profile.dailyCarbsG ?? computed?.carbsG ?? null,
    fatG: profile.dailyFatG ?? computed?.fatG ?? null,
    computed,
    tdeeKcal,
  };
}
