"use client";

import {
  effectiveTargets,
  type ActivityLevel,
  type Sex,
  type UnitSystem,
  type UpdateUserProfile,
  type UserProfile,
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { track } from "@/lib/analytics";
import { api, ApiError, type Me } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showMath, setShowMath] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((data) => {
        setMe(data);
        setProfile(data.profile);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "unknown error");
      });
  }, [router]);

  if (error) {
    return <Centered>{error}</Centered>;
  }
  if (!me || !profile) {
    return <Centered muted>Loading…</Centered>;
  }

  const update = (patch: Partial<UserProfile>) =>
    setProfile((p) => (p ? { ...p, ...patch } : p));

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await api.updateProfile(profileToPatch(profile));
      setProfile(next);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    try {
      await api.deleteAllData();
      // Fire before navigation so the SDK has a chance to send the beacon.
      track("delete_account");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "delete failed");
    }
  };

  const targets = effectiveTargets(profile);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 pb-24 md:py-12 md:pb-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <a
            href="/"
            className="font-mono text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← macros
          </a>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Settings
          </h1>
        </div>
      </header>

      <Section title="Account">
        <Row label="Email">
          <span className="break-all font-mono text-sm">{me.user.email}</span>
        </Row>
        <Row label="Theme">
          <ThemeToggle />
        </Row>
        <Row label="Sign out">
          <button
            type="button"
            onClick={async () => {
              await api.logout().catch(() => {});
              router.replace("/login");
            }}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign out of macros
          </button>
        </Row>
      </Section>

      <Section title="Profile">
        <Row label="Unit system">
          <ToggleGroup<UnitSystem>
            value={profile.unitSystem}
            options={[
              { value: "imperial", label: "Imperial" },
              { value: "metric", label: "Metric" },
            ]}
            onChange={(v) => update({ unitSystem: v })}
          />
        </Row>
        <Row label="Sex">
          <ToggleGroup<Sex | null>
            value={profile.sex}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
            onChange={(v) => update({ sex: v })}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Used by the Mifflin–St Jeor BMR equation.
          </p>
        </Row>
        <Row label="Age">
          <NumberInput
            value={profile.age}
            min={1}
            max={120}
            onChange={(v) => update({ age: v })}
            suffix="yrs"
          />
        </Row>
        <Row label="Height">
          <HeightInput
            unit={profile.unitSystem}
            heightCm={profile.heightCm}
            onChange={(cm) => update({ heightCm: cm })}
          />
        </Row>
        <Row label="Weight">
          <WeightInput
            unit={profile.unitSystem}
            weightKg={profile.weightKg}
            onChange={(kg) => update({ weightKg: kg })}
          />
        </Row>
        <Row label="Activity level">
          <select
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            value={profile.activityLevel ?? ""}
            onChange={(e) =>
              update({
                activityLevel: (e.target.value || null) as ActivityLevel | null,
              })
            }
          >
            <option value="">Select…</option>
            {ACTIVITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.hint}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Timezone">
          <div className="flex gap-2">
            <input
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={profile.timezone}
              onChange={(e) => update({ timezone: e.target.value })}
              placeholder="UTC"
            />
            <button
              type="button"
              onClick={() =>
                update({
                  timezone:
                    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
                })
              }
              className="whitespace-nowrap rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Use browser
            </button>
          </div>
        </Row>
      </Section>

      <Section title="Daily targets">
        <p className="mb-4 text-sm text-zinc-500">
          Leave blank to use the values we compute from your profile. Anything
          you fill in overrides the computed default.
        </p>
        <Row label="Calories">
          <NumberInput
            value={profile.dailyCalorieTarget}
            placeholder={
              targets.computed ? `${targets.computed.calories}` : "—"
            }
            onChange={(v) => update({ dailyCalorieTarget: v })}
            suffix="kcal"
          />
        </Row>
        <Row label="Protein">
          <NumberInput
            value={profile.dailyProteinG}
            placeholder={targets.computed ? `${targets.computed.proteinG}` : "—"}
            onChange={(v) => update({ dailyProteinG: v })}
            suffix="g"
          />
        </Row>
        <Row label="Carbs">
          <NumberInput
            value={profile.dailyCarbsG}
            placeholder={targets.computed ? `${targets.computed.carbsG}` : "—"}
            onChange={(v) => update({ dailyCarbsG: v })}
            suffix="g"
          />
        </Row>
        <Row label="Fat">
          <NumberInput
            value={profile.dailyFatG}
            placeholder={targets.computed ? `${targets.computed.fatG}` : "—"}
            onChange={(v) => update({ dailyFatG: v })}
            suffix="g"
          />
        </Row>

        <button
          type="button"
          onClick={() => setShowMath((s) => !s)}
          className="mt-4 text-sm text-[color:var(--color-accent)] hover:underline"
        >
          {showMath ? "Hide" : "How we calculate your targets"}
        </button>
        {showMath && <MathExplanation profile={profile} />}
      </Section>

      <div className="mt-10 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-[color:var(--color-accent)] px-5 py-2 font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedAt && (
          <span className="text-sm text-zinc-500">
            Saved at {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>

      <hr className="my-12 border-zinc-200 dark:border-zinc-800" />

      <Section title="Danger zone" tone="danger">
        <p className="mb-4 text-sm text-zinc-500">
          Permanently delete every meal, workout, recipe, chat message, and
          your profile. Your account row will be removed too — signing in again
          starts you fresh.
        </p>
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Delete all my data
        </button>
      </Section>

      {showDelete && (
        <DeleteModal onCancel={() => setShowDelete(false)} onConfirm={onDelete} />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers / inputs
// ---------------------------------------------------------------------------

function profileToPatch(p: UserProfile): UpdateUserProfile {
  return {
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    age: p.age,
    sex: p.sex,
    activityLevel: p.activityLevel,
    unitSystem: p.unitSystem,
    timezone: p.timezone,
    dailyCalorieTarget: p.dailyCalorieTarget,
    dailyProteinG: p.dailyProteinG,
    dailyCarbsG: p.dailyCarbsG,
    dailyFatG: p.dailyFatG,
  };
}

function Centered({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center px-6">
      <p className={muted ? "text-zinc-500" : "text-red-600 dark:text-red-400"}>
        {children}
      </p>
    </main>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2
        className={`mb-4 text-xs font-semibold uppercase tracking-widest ${
          tone === "danger"
            ? "text-red-600 dark:text-red-400"
            : "text-zinc-500"
        }`}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr] md:items-start md:gap-6">
      <label className="pt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

function MathExplanation({ profile }: { profile: UserProfile }) {
  const t = effectiveTargets(profile);
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      <p>
        <strong>BMR</strong> uses Mifflin–St Jeor:{" "}
        <code className="font-mono text-xs">
          10·kg + 6.25·cm − 5·age{" "}
          {profile.sex === "male" ? "+ 5" : profile.sex === "female" ? "− 161" : "± 5/161"}
        </code>
      </p>
      <p className="mt-2">
        <strong>TDEE</strong> = BMR × activity multiplier (1.2 sedentary →
        1.9 very active).
      </p>
      <p className="mt-2">
        <strong>Macros</strong>: protein = 0.8 g/lb bodyweight, fat = 25% of
        TDEE calories, carbs fill the remainder.
      </p>
      {t.tdeeKcal !== null && t.computed && (
        <p className="mt-3 font-mono text-xs tabular-nums">
          TDEE {Math.round(t.tdeeKcal)} kcal · P {t.computed.proteinG}g · C{" "}
          {t.computed.carbsG}g · F {t.computed.fatG}g
        </p>
      )}
      {t.tdeeKcal === null && (
        <p className="mt-3 text-xs text-zinc-500">
          Fill in weight, height, age, sex, and activity level to see your
          numbers.
        </p>
      )}
    </div>
  );
}

function DeleteModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = typed === "DELETE";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
          Delete all my data
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This permanently removes every meal, workout, recipe, chat message,
          and your profile. The action cannot be undone.
        </p>
        <p className="mt-4 text-sm">
          Type <code className="font-mono">DELETE</code> to confirm:
        </p>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete everything"}
          </button>
        </div>
      </div>
    </div>
  );
}
