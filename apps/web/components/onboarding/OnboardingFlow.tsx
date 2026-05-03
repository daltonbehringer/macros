"use client";

import {
  defaultMacroTargets,
  needsOnboarding,
  tdee,
  type ActivityLevel,
  type Sex,
  type UnitSystem,
} from "@macros/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ACTIVITY_OPTIONS,
  HeightInput,
  NumberInput,
  ToggleGroup,
  WeightInput,
} from "@/components/profile/inputs";
import { api, ApiError } from "@/lib/api";

type Step = 1 | 2 | 3;

type Draft = {
  sex: Sex | null;
  age: number | null;
  activityLevel: ActivityLevel | null;
  unitSystem: UnitSystem;
  heightCm: number | null;
  weightKg: number | null;
};

const EMPTY: Draft = {
  sex: null,
  age: null,
  activityLevel: null,
  unitSystem: "imperial",
  heightCm: null,
  weightKg: null,
};

export function OnboardingFlow() {
  const router = useRouter();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: bounce out if the user has already onboarded (or isn't logged in).
  // Also picks up unitSystem default from their existing profile.
  useEffect(() => {
    api
      .me()
      .then((me) => {
        if (!me.profile) {
          router.replace("/login");
          return;
        }
        if (!needsOnboarding(me.profile)) {
          router.replace("/");
          return;
        }
        setDraft((d) => ({ ...d, unitSystem: me.profile!.unitSystem }));
        setBootstrapped(true);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "load failed");
      });
  }, [router]);

  if (error) {
    return (
      <Frame>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </Frame>
    );
  }
  if (!bootstrapped) {
    return (
      <Frame>
        <p className="text-zinc-500">Loading…</p>
      </Frame>
    );
  }

  const onComplete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.updateProfile({
        sex: draft.sex,
        age: draft.age,
        activityLevel: draft.activityLevel,
        unitSystem: draft.unitSystem,
        heightCm: draft.heightCm,
        weightKg: draft.weightKg,
      });
      router.replace("/?focus=chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
      setSubmitting(false);
    }
  };

  return (
    <Frame>
      <Progress step={step} />

      {step === 1 && (
        <StepAbout
          draft={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepBody
          draft={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepTargets
          draft={draft}
          onBack={() => setStep(2)}
          onComplete={onComplete}
          submitting={submitting}
          error={error}
        />
      )}
    </Frame>
  );
}

// ---------------------------------------------------------------------------

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-10 sm:py-16">
      <a
        href="/"
        className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        macros
      </a>
      <div className="mt-12 flex-1">{children}</div>
    </main>
  );
}

function Progress({ step }: { step: Step }) {
  return (
    <div className="mb-12 flex items-center gap-3">
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          className={`h-1.5 flex-1 rounded-full transition ${
            n <= step
              ? "bg-[color:var(--color-accent)]"
              : "bg-zinc-200 dark:bg-zinc-800"
          }`}
        />
      ))}
    </div>
  );
}

function Eyebrow({ n, label }: { n: string; label: string }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
      <span className="tabular-nums">{n}</span> · {label}
    </p>
  );
}

function PrimaryButton({
  disabled,
  children,
  onClick,
  type = "button",
}: {
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md bg-[color:var(--color-accent)] px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-[color:var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      ← Back
    </button>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function StepAbout({
  draft,
  onChange,
  onNext,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onNext: () => void;
}) {
  const ready =
    draft.sex !== null && draft.age !== null && draft.activityLevel !== null;

  return (
    <div>
      <Eyebrow n="01 / 03" label="About you" />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Tell us a bit about you.
      </h1>

      <div className="mt-10 flex flex-col gap-8">
        <Field label="Sex">
          <ToggleGroup<Sex | null>
            value={draft.sex}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
            onChange={(sex) => onChange({ sex })}
          />
        </Field>

        <Field label="Age">
          <NumberInput
            value={draft.age}
            min={1}
            max={120}
            onChange={(age) => onChange({ age })}
            suffix="yrs"
          />
        </Field>

        <Field label="Activity level">
          <div className="flex flex-col gap-2">
            {ACTIVITY_OPTIONS.map((o) => {
              const active = draft.activityLevel === o.value;
              return (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => onChange({ activityLevel: o.value })}
                  className={`flex items-baseline justify-between rounded-md border px-4 py-3 text-left transition ${
                    active
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  }`}
                >
                  <span className="text-sm font-medium">{o.label}</span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {o.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="mt-12 flex items-center justify-end">
        <PrimaryButton disabled={!ready} onClick={onNext}>
          Next <span aria-hidden>→</span>
        </PrimaryButton>
      </div>
    </div>
  );
}

function StepBody({
  draft,
  onChange,
  onBack,
  onNext,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const ready = draft.heightCm !== null && draft.weightKg !== null;

  return (
    <div>
      <Eyebrow n="02 / 03" label="Your body" />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        How tall are you, and how much do you weigh?
      </h1>
      <p className="mt-3 text-sm text-zinc-500">
        We use this to estimate your daily calories.
      </p>

      <div className="mt-10 flex flex-col gap-8">
        <Field label="Units">
          <ToggleGroup<UnitSystem>
            value={draft.unitSystem}
            options={[
              { value: "imperial", label: "Imperial" },
              { value: "metric", label: "Metric" },
            ]}
            onChange={(unitSystem) => onChange({ unitSystem })}
          />
        </Field>

        <Field label="Height">
          <HeightInput
            unit={draft.unitSystem}
            heightCm={draft.heightCm}
            onChange={(heightCm) => onChange({ heightCm })}
          />
        </Field>

        <Field label="Weight">
          <WeightInput
            unit={draft.unitSystem}
            weightKg={draft.weightKg}
            onChange={(weightKg) => onChange({ weightKg })}
          />
        </Field>
      </div>

      <div className="mt-12 flex items-center justify-between">
        <BackLink onClick={onBack} />
        <PrimaryButton disabled={!ready} onClick={onNext}>
          Next <span aria-hidden>→</span>
        </PrimaryButton>
      </div>
    </div>
  );
}

function StepTargets({
  draft,
  onBack,
  onComplete,
  submitting,
  error,
}: {
  draft: Draft;
  onBack: () => void;
  onComplete: () => void;
  submitting: boolean;
  error: string | null;
}) {
  // All five identity fields are guaranteed non-null at this step (gated by
  // step 1 + step 2 readiness). Compute targets here for the preview.
  const tdeeKcal = tdee({
    weightKg: draft.weightKg!,
    heightCm: draft.heightCm!,
    age: draft.age!,
    sex: draft.sex!,
    activityLevel: draft.activityLevel!,
  });
  const computed = defaultMacroTargets({
    weightKg: draft.weightKg!,
    tdeeKcal,
  });

  return (
    <div>
      <Eyebrow n="03 / 03" label="Your targets" />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Here&apos;s where you&apos;ll land.
      </h1>
      <p className="mt-3 text-sm text-zinc-500">
        Based on Mifflin–St Jeor BMR × your activity level. You can override any
        of these in Settings.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <TargetTile label="Calories" unit="kcal" value={computed.calories} accent />
        <TargetTile label="Protein" unit="g" value={computed.proteinG} />
        <TargetTile label="Carbs" unit="g" value={computed.carbsG} />
        <TargetTile label="Fat" unit="g" value={computed.fatG} />
      </div>

      <p className="mt-8 font-mono text-[11px] uppercase tracking-widest text-zinc-500 tabular-nums">
        TDEE {Math.round(tdeeKcal)} kcal · {computed.proteinG}P ·{" "}
        {computed.carbsG}C · {computed.fatG}F
      </p>

      <div className="mt-12 flex items-center justify-between">
        <BackLink onClick={onBack} />
        <PrimaryButton disabled={submitting} onClick={onComplete}>
          {submitting ? "Saving…" : "Let's go"}
          {!submitting && <span aria-hidden>→</span>}
        </PrimaryButton>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function TargetTile({
  label,
  unit,
  value,
  accent,
}: {
  label: string;
  unit: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-200 px-4 py-5 dark:border-zinc-800">
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          accent ? "text-[color:var(--color-accent)]" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
        {unit}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>
      {children}
    </div>
  );
}
