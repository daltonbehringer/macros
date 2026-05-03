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
 * True iff a profile has none of the five identity fields set. Used to gate
 * first-run onboarding — once a user touches any of these in Settings or via
 * the onboarding flow, we never force them through onboarding again.
 *
 * `unitSystem` and `timezone` are intentionally excluded; both have defaults
 * set on row creation, so checking them would always return false.
 */
export function needsOnboarding(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.weightKg === null &&
    profile.heightCm === null &&
    profile.age === null &&
    profile.sex === null &&
    profile.activityLevel === null
  );
}

/**
 * Effective targets for a user. Returns null for any value that can't be
 * computed yet (profile incomplete) and isn't overridden.
 *
 * `extraCaloriesAvailable` (typically active workout burn for the day) inflates
 * the budget: the calorie target gets +burn, and the energy macros (carbs, fat)
 * absorb the extra in a 75/25 split (matching the default split used elsewhere).
 * Protein stays put — it's a bodyweight-driven floor, not an energy target.
 */
export function effectiveTargets(
  profile: UserProfile,
  options: { extraCaloriesAvailable?: number } = {},
): {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  computed: ComputedTargets | null;
  tdeeKcal: number | null;
  /** What the burn added on top of the base goal (zero when no extra). */
  bonus: { calories: number; carbsG: number; fatG: number };
} {
  const extra = Math.max(0, options.extraCaloriesAvailable ?? 0);

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

  // Bonus from extra calories — fat 25% / carbs 75%, protein unchanged.
  const bonusFatG = Math.round((extra * 0.25) / 9);
  const bonusCarbsG = Math.max(
    0,
    Math.round((extra - bonusFatG * 9) / 4),
  );
  const bonus = { calories: extra, carbsG: bonusCarbsG, fatG: bonusFatG };

  const baseCalories =
    profile.dailyCalorieTarget ?? computed?.calories ?? null;
  const baseProtein = profile.dailyProteinG ?? computed?.proteinG ?? null;
  const baseCarbs = profile.dailyCarbsG ?? computed?.carbsG ?? null;
  const baseFat = profile.dailyFatG ?? computed?.fatG ?? null;

  return {
    calories: baseCalories === null ? null : baseCalories + bonus.calories,
    proteinG: baseProtein,
    carbsG: baseCarbs === null ? null : baseCarbs + bonus.carbsG,
    fatG: baseFat === null ? null : baseFat + bonus.fatG,
    computed,
    tdeeKcal,
    bonus,
  };
}
