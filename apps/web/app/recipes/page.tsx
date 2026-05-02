"use client";

import type {
  CreateRecipeInput,
  Recipe,
  RecipeIngredient,
} from "@macros/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";

type DraftRecipe = {
  id?: string;
  name: string;
  description: string;
  ingredientsText: string; // one ingredient per line, "name | quantity"
  caloriesPerServing: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  servings: string;
};

const EMPTY_DRAFT: DraftRecipe = {
  name: "",
  description: "",
  ingredientsText: "",
  caloriesPerServing: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  servings: "1",
};

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<DraftRecipe | null>(null);
  const [logging, setLogging] = useState<Recipe | null>(null);

  const refresh = async (q?: string) => {
    try {
      const rows = await api.listRecipes(q);
      setRecipes(rows);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "load failed");
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => recipes, [recipes]);

  const onSave = async (d: DraftRecipe) => {
    setError(null);
    const payload: CreateRecipeInput = {
      name: d.name.trim(),
      description: d.description.trim() || null,
      ingredients: parseIngredients(d.ingredientsText),
      caloriesPerServing: Number(d.caloriesPerServing) || 0,
      proteinG: Number(d.proteinG) || 0,
      carbsG: Number(d.carbsG) || 0,
      fatG: Number(d.fatG) || 0,
      servings: Number(d.servings) || 1,
    };
    try {
      if (d.id) {
        await api.updateRecipe(d.id, payload);
      } else {
        await api.createRecipe(payload);
      }
      setDraft(null);
      await refresh(query || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    }
  };

  const onDelete = async (id: string) => {
    setRecipes((xs) => xs.filter((r) => r.id !== id));
    try {
      await api.deleteRecipe(id);
    } catch {
      await refresh(query || undefined);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← macros
        </a>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
          className="rounded-md bg-[color:var(--color-accent)] px-3 py-1 text-sm font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)]"
        >
          + New recipe
        </button>
      </header>

      <h1 className="text-3xl font-semibold tracking-tight">Recipes</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Saved meals you log in one tap.
      </p>

      <div className="my-6 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") refresh(query || undefined);
          }}
          placeholder="Search by name…"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              refresh();
            }}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            clear
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {loaded && filtered.length === 0 && !draft && (
        <div className="rounded-md border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No recipes yet. Create one, or ask macros to save one in chat.
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {filtered.map((r) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            onEdit={() => setDraft(toDraft(r))}
            onDelete={() => onDelete(r.id)}
            onLog={() => setLogging(r)}
          />
        ))}
      </ul>

      {draft && (
        <RecipeFormModal
          draft={draft}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={onSave}
        />
      )}

      {logging && (
        <LogRecipeModal
          recipe={logging}
          onCancel={() => setLogging(null)}
          onConfirm={async (servings) => {
            try {
              await api.logRecipe(logging.id, servings);
              setLogging(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "log failed");
            }
          }}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function parseIngredients(text: string): RecipeIngredient[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split("|").map((s) => s.trim());
      return { name: name ?? line, quantity: rest.join(" | ") };
    });
}

function ingredientsToText(items: RecipeIngredient[]): string {
  return items
    .map((i) => (i.quantity ? `${i.name} | ${i.quantity}` : i.name))
    .join("\n");
}

function toDraft(r: Recipe): DraftRecipe {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    ingredientsText: ingredientsToText(r.ingredients),
    caloriesPerServing: String(r.caloriesPerServing),
    proteinG: String(r.proteinG),
    carbsG: String(r.carbsG),
    fatG: String(r.fatG),
    servings: String(r.servings),
  };
}

function RecipeCard({
  recipe,
  onEdit,
  onDelete,
  onLog,
}: {
  recipe: Recipe;
  onEdit: () => void;
  onDelete: () => void;
  onLog: () => void;
}) {
  return (
    <li className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{recipe.name}</h3>
          {recipe.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
              {recipe.description}
            </p>
          )}
        </div>
        {recipe.createdBy === "llm" && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:bg-zinc-800">
            llm
          </span>
        )}
      </div>
      <div className="mt-3 font-mono text-xs text-zinc-600 tabular-nums dark:text-zinc-400">
        {Math.round(recipe.caloriesPerServing)} kcal · P {recipe.proteinG}g · C{" "}
        {recipe.carbsG}g · F {recipe.fatG}g
        <span className="ml-2 text-zinc-400">
          per serving · {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"} total
        </span>
      </div>
      {recipe.ingredients.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          {recipe.ingredients.slice(0, 5).map((i, idx) => (
            <li key={idx}>
              <span className="font-medium">{i.name}</span>
              {i.quantity && (
                <span className="ml-2 font-mono text-zinc-500">{i.quantity}</span>
              )}
            </li>
          ))}
          {recipe.ingredients.length > 5 && (
            <li className="text-zinc-400">
              + {recipe.ingredients.length - 5} more
            </li>
          )}
        </ul>
      )}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onLog}
          className="rounded-md bg-[color:var(--color-accent)] px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)]"
        >
          Log
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function RecipeFormModal({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: DraftRecipe;
  onChange: (d: DraftRecipe) => void;
  onCancel: () => void;
  onSave: (d: DraftRecipe) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const update = <K extends keyof DraftRecipe>(k: K, v: DraftRecipe[K]) =>
    onChange({ ...draft, [k]: v });
  const isValid = draft.name.trim().length > 0;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-lg font-semibold">
          {draft.id ? "Edit recipe" : "New recipe"}
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" full>
            <input
              required
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Description" full>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => update("description", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Calories / serving">
            <input
              type="number"
              min={0}
              value={draft.caloriesPerServing}
              onChange={(e) => update("caloriesPerServing", e.target.value)}
              className={`${inputCls} tabular-nums`}
            />
          </Field>
          <Field label="Servings (recipe yield)">
            <input
              type="number"
              min={0.1}
              step="0.1"
              value={draft.servings}
              onChange={(e) => update("servings", e.target.value)}
              className={`${inputCls} tabular-nums`}
            />
          </Field>
          <Field label="Protein g / serving">
            <input
              type="number"
              min={0}
              value={draft.proteinG}
              onChange={(e) => update("proteinG", e.target.value)}
              className={`${inputCls} tabular-nums`}
            />
          </Field>
          <Field label="Carbs g / serving">
            <input
              type="number"
              min={0}
              value={draft.carbsG}
              onChange={(e) => update("carbsG", e.target.value)}
              className={`${inputCls} tabular-nums`}
            />
          </Field>
          <Field label="Fat g / serving">
            <input
              type="number"
              min={0}
              value={draft.fatG}
              onChange={(e) => update("fatG", e.target.value)}
              className={`${inputCls} tabular-nums`}
            />
          </Field>
          <Field label="Ingredients (one per line, optional 'name | qty')" full>
            <textarea
              rows={5}
              value={draft.ingredientsText}
              onChange={(e) => update("ingredientsText", e.target.value)}
              placeholder={"chicken breast | 6 oz\nrice | 1 cup\nbroccoli | 1 cup"}
              className={`${inputCls} font-mono text-xs`}
            />
          </Field>
        </div>
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
            disabled={!isValid || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(draft);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
          >
            {busy ? "Saving…" : draft.id ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogRecipeModal({
  recipe,
  onCancel,
  onConfirm,
}: {
  recipe: Recipe;
  onCancel: () => void;
  onConfirm: (servings: number) => Promise<void>;
}) {
  const [servings, setServings] = useState("1");
  const [busy, setBusy] = useState(false);
  const factor = Number(servings) || 0;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-lg font-semibold">Log {recipe.name}</h3>
        <div className="mt-4 flex items-center gap-2">
          <label className="text-sm">Servings:</label>
          <input
            autoFocus
            type="number"
            min={0.1}
            step="0.1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className={`${inputCls} w-24 tabular-nums`}
          />
        </div>
        <div className="mt-4 rounded-md bg-zinc-50 p-3 font-mono text-xs tabular-nums dark:bg-zinc-900">
          {Math.round(recipe.caloriesPerServing * factor)} kcal · P{" "}
          {(recipe.proteinG * factor).toFixed(1)}g · C{" "}
          {(recipe.carbsG * factor).toFixed(1)}g · F{" "}
          {(recipe.fatG * factor).toFixed(1)}g
        </div>
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
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(factor);
              } finally {
                setBusy(false);
              }
            }}
            disabled={!factor || busy}
            className="rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
          >
            {busy ? "Logging…" : "Log meal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
