# Macros MVP — Phase 1 Build Plan

Sequencing follows the spec's build order with concrete checkable items. Each section is roughly one PR.

## Resolved decisions (2026-05-01)

- Chat history retention: **rolling 30 days** (cleanup job)
- Macro defaults: **derived** — protein 0.8 g/lb bodyweight, fat 25% of TDEE, carbs fill the remainder. User can override any field in settings.
- Workout calorie burn: **LLM sanity-checks** against METs tables in the system prompt; flags outliers in chat reply, still logs the user's value if they confirm.
- Timezones: **store UTC**, render in browser-local TZ. Pass `Intl.DateTimeFormat().resolvedOptions().timeZone` from the client when needed for "today" queries.
- Tooling: **Turborepo + pnpm workspaces**.
- Backend: **Fastify** (TypeScript).
- Local dev DB: **docker-compose Postgres**.
- Existing `macros.db` + Python prototype: **dropped entirely**, no migration.
- Auth: **Stytch Consumer** — email magic links + Google OAuth from day one.
- Prod domain: **macros.dalty.io**.

## Step 0 — Wipe + scaffold (PR 1) ✅

- [x] Delete Python prototype
- [x] Move secrets into `apps/api/.env.local`, scrub spec
- [x] Bootstrap monorepo: `pnpm-workspace.yaml`, `turbo.json`, root `package.json`
- [x] Create `apps/web` (Next.js 15, App Router, TS, Tailwind v4)
- [x] Create `apps/api` (Fastify + TS + tsx)
- [x] Create `packages/shared` (zod schemas + macro math)
- [x] Create `packages/db` (Drizzle skeleton — real schema in PR 2)
- [x] `docker-compose.yml` with Postgres 16
- [x] `.env.example` for both apps
- [x] Root `.gitignore` for Node monorepo
- [x] `pnpm dev` ready (currently each app run individually until pnpm is on PATH)

## Step 1 — DB schema + RLS + safe query helper (PR 2) ✅

- [x] Drizzle schema for: `users`, `user_profiles`, `meals`, `workouts`, `recipes`, `chat_messages`
- [x] Indexes: `(user_id, consumed_at)` on meals, `(user_id, performed_at)` on workouts, `(user_id, created_at)` on chat_messages, `(user_id)` on recipes
- [x] Generated `0000_*.sql` (tables + FKs + indexes) and hand-written `0001_rls.sql` (enable + force + policies with NULLIF guard)
- [x] `0002_app_role.sql` — non-super `app_user` role; `forUser()` does `SET LOCAL ROLE app_user` so RLS actually applies (superusers bypass otherwise)
- [x] `forUser(db, userId, fn)` helper — txn-scoped, validates UUID, sets ROLE + GUC
- [x] 12 integration tests passing — input validation, GUC propagation, cross-user SELECT/UPDATE/INSERT/DELETE blocked on every user-scoped table, fail-closed when no GUC

## Step 2 — Stytch auth end-to-end (PR 3) ✅

- [x] `apps/api/src/auth/stytch.ts` — magic link send + authenticate, OAuth authenticate, session validate/revoke
- [x] OAuth start happens client-side via `https://test.stytch.com/v1/public/oauth/google/start` redirect (no backend route needed)
- [x] `requireAuth` preHandler: validates Stytch session cookie, attaches `req.user`. GUC is set per-query inside `forUser()`, not in middleware.
- [x] First-auth provisioning: insert `users` row + empty `user_profiles` (latter via `forUser()`)
- [x] `apps/web/app/login/page.tsx` — magic link form + Google button
- [x] `apps/web/app/auth/callback/page.tsx` — token exchange (handles both `magic_links` and `oauth` types)
- [x] `GET /me` returns current user + profile
- [ ] **User action**: register redirect URLs in Stytch dashboard (see PR 3 review)

## Step 3 — Settings + TDEE (PR 4) ✅

- [x] `/settings` page: height (ft+in or cm), weight (lb or kg), age, sex, activity level, unit system, timezone (with browser autodetect)
- [x] BMR (Mifflin–St Jeor) and TDEE in `packages/shared/src/macros.ts`; `effectiveTargets()` resolves overrides → computed → null
- [x] Derived macro defaults: 0.8 g/lb protein, 25% fat, carbs remainder
- [x] Override fields for calorie / protein / carbs / fat with computed values shown as placeholders
- [x] "How we calculate your targets" expandable section
- [x] Delete-all-data: typed-DELETE modal → wipes every user-scoped table including `chat_messages` and the `users` row, revokes Stytch session, redirects to `/login`

## Step 4 — Manual logging (PR 5) ✅

- [x] `POST /meals`, `GET /meals?from=&to=`, `DELETE /meals/:id` — manual entry path, source forced to `"manual"` server-side
- [x] `POST /workouts`, `GET /workouts?from=&to=`, `DELETE /workouts/:id`
- [x] All inputs validated with zod, all queries via `forUser(userId)` so RLS applies
- [x] Today view on home: meal + workout forms, totals bar (eaten / burned / remaining / protein progress), inline lists with optimistic delete
- [x] Range queries take ISO `from`/`to` so the client computes "today in browser TZ" once and the server stays TZ-agnostic

## Step 5 — Dashboard (PR 6) ✅

- [x] Four `MacroRing`s — calorie ring uses accent color, macros use neutral zinc; ring turns red on overshoot
- [x] Hero "remaining" number top of page in accent (or red when negative); fallback prompt to Settings when profile incomplete
- [x] `ActivityFeed` — merged meals + workouts, sorted desc, capped to 10, accent dot for meals / outline dot for workouts; per-row delete on hover
- [x] `QuickChatInput` — placeholder textarea (Enter submits, Shift+Enter newline); shows "coming next PR" hint until PR 7 wires the real chat
- [x] Manual log forms moved behind a "+ Log manually" toggle so they stay accessible while not dominating the dashboard
- [x] `tabular-nums` on every number that displays

## Step 6 — LLM chat with tool use (PR 7) ✅

- [x] Four tools wired: `log_meal`, `log_workout`, `get_daily_summary`, `get_recent_meals`. (`save_recipe`/`get_recipes` deferred to PR 8 alongside the recipes UI.)
- [x] Anthropic SDK 0.92, model `claude-sonnet-4-6` with `thinking: {type: "adaptive"}` and `effort: "high"`
- [x] System prompt split into stable prefix (cached via `cache_control: ephemeral`) and volatile tail (today's date, targets, totals, last 7 days of meals, METs reference)
- [x] Tool-use loop with 8-iteration cap, executes tools via `forUser()` so RLS applies, returns final text + audit log
- [x] Persists user + assistant turns to `chat_messages` (tool calls stored as jsonb on assistant row)
- [x] `/chat` full-screen page with optimistic user bubble, Enter-to-send, scroll-to-bottom
- [x] Dashboard `QuickChatInput` wired — submission triggers refresh of meals/workouts when tools logged anything
- [x] Rolling 30-day cleanup runs on every chat send (cheap, scoped to current user)

## Step 7 — Recipes (PR 8) ✅

- [x] `/recipes` page: search, create/edit modal, delete, "Log this" modal with live macro preview
- [x] LLM tools: `save_recipe`, `get_recipes`, `log_meal_from_recipe` (multiplies per-serving macros by servings, sets `source: "recipe"`)
- [x] Manual logging path: `POST /recipes/:id/log` mirrors the LLM tool's math
- [x] Header links to /recipes from the dashboard

## Step 8 — History + charts (PR 9) ✅

- [x] `/history` with 7d / 30d / 90d / custom range picker
- [x] Recharts: calorie trend (line + target reference line), macro stacked bar, net-vs-target bar (accent if deficit, red if surplus)
- [x] Server aggregates per-day in the user's TZ via `(consumed_at AT TIME ZONE tz)::date`; client renders zero-filled rows for missing days
- [x] Tabular-nums tooltips, dark-themed tooltip surface, accent color on hero metrics

## Step 9 — Polish (PR 10) ✅

- [x] Geist + Geist Mono via `next/font/google` — variables `--font-geist` / `--font-geist-mono` flow into Tailwind v4's `@theme` font tokens
- [x] No-flash theme script in `<head>` reads `localStorage('theme')` then falls back to system preference; sets `class="dark"` on `<html>` before React hydrates
- [x] `ThemeToggle` (light / system / dark) on Settings; system mode tracks `prefers-color-scheme`
- [x] `BottomNav` component (Today / Chat / Recipes / History / Settings) — `md:hidden`, hidden on `/login`, `/auth/callback`, `/chat`
- [x] Header link rows are `hidden md:flex`; mobile shows just the macros logo + email→/settings shortcut
- [x] Every protected page has `pb-24 md:pb-10` to clear the fixed bottom nav
- [x] Sign out moved into Settings (was previously only in dashboard header)
- [x] Accent stays at `#00e08a` electric green (chosen in PR 1, validated in browser)

## Step 10 — Deploy (PR 11) ✅ (codebase ready; cloud setup is your action)

- [x] Codebase production-ready: tsx-based prod runtime, `/healthz` with DB ping, trustProxy enabled in prod, secure cookies in prod, optional `COOKIE_DOMAIN`
- [x] Vercel rewrite `/api/*` → Railway target (same-origin proxy — no CORS, no cross-domain cookies)
- [x] Stytch OAuth base detected from public-token prefix (test vs live)
- [x] Platform configs: [`apps/web/vercel.json`](apps/web/vercel.json), root [`railway.toml`](railway.toml) + [`nixpacks.toml`](nixpacks.toml)
- [x] Deploy runbook: [`DEPLOY.md`](DEPLOY.md) — Railway setup, Vercel setup, DNS, Stytch live config, smoke tests, common ops
- [ ] **Your action**: provision Railway + Vercel projects, point DNS, configure Stytch Live, run the smoke test in [DEPLOY.md §5](DEPLOY.md)

## Non-negotiables (re-check every PR)

- Every user-data query is `db.forUser(userId)` AND RLS is enabled
- No secrets in repo. `.env*` gitignored except `.env.example`
- LLM tool implementations validate inputs and enforce user scoping — never trust tool args
- Mobile works at 375px without horizontal scroll
- Both light and dark mode tested
- Delete-all-data hits every user-scoped table

## Review section

### PR 1 — Wipe + scaffold (2026-05-01)

**What landed.** Empty Python prototype deleted. Monorepo live with Turborepo + pnpm 9 workspaces, four packages: `apps/api` (Fastify + zod-validated env + `/health`), `apps/web` (Next.js 15 + Tailwind v4 placeholder page wired to `--color-accent`), `packages/shared` (zod schemas for profile/meals/workouts/recipes/chat + Mifflin-St Jeor + derived macro defaults), `packages/db` (Drizzle config, postgres-js client, `forUser` placeholder that throws until PR 2). Secrets moved to `apps/api/.env.local`; spec scrubbed. `docker-compose.yml` defines Postgres 16. Root `README.md` covers local dev steps.

**Verified.**
- `corepack pnpm install` succeeds (261 packages, no peer-dep failures).
- All four packages typecheck clean (`tsc --noEmit`).
- API boots, `GET /health` returns `{status:"ok",env:"development",time:...}`.
- Web boots on :3000, renders placeholder page with Tailwind v4 styles applied.

**Watch.**
- pnpm is not on the user's PATH. `corepack pnpm` works one-off but `turbo` shells out to a global pnpm and fails. PR 2 should not start until `brew install pnpm` (or `sudo corepack enable`) so `pnpm dev` runs both apps via Turborepo.
- Tailwind v4 is still beta in pinned versions; bump to GA before deploy.
- `STYTCH_PUBLIC_TOKEN` is empty in `.env.local` — must be filled in from the Stytch dashboard before PR 3 (auth) can be tested end-to-end.
- `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` in `apps/web/.env.local` is also empty for the same reason.

### PR 2 — DB schema + RLS + forUser (2026-05-01)

**What landed.** Six Drizzle tables (`users`, `user_profiles`, `meals`, `workouts`, `recipes`, `chat_messages`) with UUID PKs, timestamptz, jsonb where appropriate, and FK cascade-delete from `users`. Indexes on every `user_id` access path. Three migrations: generated `0000_*` for tables/FKs/indexes, hand-written `0001_rls.sql` enabling + forcing RLS with policies keyed on `NULLIF(current_setting('app.current_user_id', true), '')::uuid`, and `0002_app_role.sql` creating the non-super `app_user` role with the minimum CRUD grants. `forUser(db, userId, fn)` opens a transaction, `SET LOCAL ROLE app_user`, sets the GUC, then runs the callback — the only sanctioned path to user data. 12 vitest integration tests cover input validation, GUC propagation, and cross-user SELECT/UPDATE/INSERT/DELETE blocking on every user-scoped table; "no GUC means no rows" is verified explicitly.

**Verified.**
- `pnpm db:migrate` cleanly applies all three migrations to a fresh `macros` database.
- `pnpm --filter @macros/db test` — 12/12 green.
- Tests reset `macros_test` from scratch on each run via `setup.ts`, so they're hermetic.

**Watch.**
- Two design decisions worth flagging for PR 3 review:
  1. `users` table is intentionally NOT under RLS — auth needs to look up by `stytch_user_id` pre-context. Application middleware is the sole guard.
  2. `set_config(...,true)` leaves `''` as the prior value once the GUC has been touched in a session. Policies use `NULLIF(...,'')::uuid` to fail closed on that path. If anyone changes the policy SQL, they must preserve the `NULLIF`.
- Migration `0002` creates `app_user` if missing — idempotent on re-run, but production Postgres roles are typically managed out-of-band. Railway Postgres should be checked in PR 11 to ensure the migration's `CREATE ROLE` doesn't fail (and if it does, fall back to a manual one-time setup script).

### PR 3 — Stytch auth end-to-end (2026-05-01)

**What landed.** `apps/api/src/auth/` — Stytch client wrapper (`stytch.ts`), cookie config (`cookie.ts`), `requireAuth` Fastify preHandler (`middleware.ts`), first-login user provisioning (`provision.ts`), routes (`routes.ts`: `POST /auth/magic-link/send`, `POST /auth/authenticate`, `POST /auth/logout`, `GET /me`). API uses an HttpOnly `macros_session` cookie scoped to the API origin, `SameSite=Lax`, `Secure` in production. CORS allows credentials from the configured frontend origin. On first auth, we insert `users` then `user_profiles` (the latter through `forUser()` so RLS WITH CHECK accepts it). `/me` is the only protected route in this PR; later routes will add `{ preHandler: requireAuth }`.

Web side: `apps/web/lib/api.ts` is the typed fetch wrapper (always `credentials: "include"`), `app/login/page.tsx` has email + Google buttons (Google redirects to Stytch's hosted OAuth start with `public_token`), `app/auth/callback/page.tsx` exchanges the `?token=` query param for a session, and `app/page.tsx` is now gated — calls `/me` on mount, redirects to `/login` on 401.

**Verified.**
- `pnpm --filter @macros/api typecheck` and `pnpm --filter @macros/web typecheck` clean.
- `GET /health` 200, `GET /me` 401 (no cookie), bad-input `POST /auth/magic-link/send` returns 400.
- Real Stytch round-trip: `POST /auth/magic-link/send` to test environment returns Stytch's actual error response (`no_match_for_provided_magic_link_url`) — confirms credentials are loading and the SDK is talking to Stytch.
- `/login` and `/auth/callback` render correctly server-side; Tailwind classes applied.

**User action required before browser-testing the full flow:**
1. Stytch Dashboard → **Configuration → Redirect URLs**, add `http://localhost:3000/auth/callback` to the **Login** and **Sign-up** lists for the Test environment.
2. To test Google OAuth: Stytch Dashboard → **OAuth** → enable Google for the Test project (no Google Cloud setup needed in test mode).

**Watch.**
- Cross-origin cookie strategy in dev: web at `:3000`, API at `:4000`. Same eTLD+1, so SameSite=Lax sends the cookie on `fetch(..., { credentials: "include" })`. In prod we'll either subdomain (`api.macros.dalty.io` + `Domain=.macros.dalty.io`) or use Vercel rewrites to make API same-origin — decide in PR 11.
- We call `stytch.sessions.authenticate` on every protected request. ~50–100ms. JWT verification is offline and cacheable; revisit in PR 6+ if request latency matters.
- Google OAuth start URL hard-codes `test.stytch.com`. Swap to `api.stytch.com` (or use `STYTCH_LIVE` env) in PR 11.

### PR 4 — Settings + TDEE (2026-05-01)

**What landed.** `apps/api/src/profile/routes.ts` exposes `GET /profile`, `PUT /profile` (PATCH semantics — only sent keys are written), and `DELETE /me/data` (requires `{confirmation: "DELETE"}` in the body, wipes every user-scoped table via `forUser()` plus the `users` row, revokes the Stytch session, clears the cookie). `packages/shared` got `effectiveTargets()` plus camelCase'd schemas to match Drizzle's wire format (every `*_g` → `*G`, `weight_kg` → `weightKg`, etc.). Web side: `apps/web/lib/units.ts` has the lb/kg + ft+in/cm converters; `apps/web/app/settings/page.tsx` is the form with sectioned account/profile/targets/danger-zone, ToggleGroup + NumberInput + HeightInput + WeightInput inputs, an expandable "how we calculate" panel that shows the live TDEE/macro numbers when the profile is complete, and a typed-DELETE modal. Home page now links to `/settings`.

**Verified.**
- `pnpm --filter @macros/{shared,api,web} typecheck` clean across the board.
- `pnpm --filter @macros/db test` — 12/12 still green after the schema rename.
- `GET /profile`, `PUT /profile`, `DELETE /me/data` all return 401 without a session cookie.
- `/settings` SSR renders the loading shell; client-side fetch returns 401, redirect logic kicks in.

**Watch.**
- Profile PATCH excludes `userId`, `createdAt`, `updatedAt` by virtue of zod schema. If you ever broaden `UpdateUserProfile`, audit which keys land in `set()`.
- Unit conversion happens in the input components — display value lives in user's chosen unit, canonical metric in `profile`. If a future refactor splits "draft" from "saved" state, watch for the round-tripping (lb→kg→lb may drift by ±0.1 lb due to flooring).
- Delete flow deletes the `users` row last, outside `forUser()`. If a future change adds new RLS-protected tables that reference `users`, add their delete inside the `forUser()` block before the `users` delete fires.
- Timezone is a free-text field today. PR 5+ should validate against `Intl.supportedValuesOf("timeZone")` server-side before stamping it on `consumed_at` queries.

### PR 5 — Manual logging (2026-05-01)

**What landed.** `apps/api/src/{meals,workouts}/routes.ts` — three routes each: `POST` (create, validated by zod), `GET ?from=&to=` (date-range listing), `DELETE /:id`. Every query goes through `forUser()`. Meal `source` is server-forced to `"manual"` regardless of what the client sends, so the LLM-parsed path (PR 7) lands on its own seam. Range queries take ISO `from`/`to` strings — the client computes today's UTC range from the browser's TZ via `apps/web/lib/dates.ts:todayRange()`, which keeps the server TZ-agnostic.

Web side: `apps/web/lib/api.ts` got `listMeals` / `createMeal` / `deleteMeal` and the same trio for workouts. `apps/web/app/page.tsx` is now the Today view: header (email / Settings / Sign out), totals bar (eaten / burned / remaining calories + protein progress against target), two side-by-side forms (meal: description + cal + P/C/F; workout: description + kcal burned + duration), and two lists with optimistic delete.

**Verified.**
- `pnpm typecheck` (turbo) — all 4 packages green.
- `pnpm --filter @macros/db test` — 12/12 still green.
- All six new routes return 401 without a session cookie.

**Watch.**
- "Remaining" calories arithmetic on the totals bar = `target - eaten + burned`. Matches the spec's `consumed − TDEE − active_workout_calories` where target≈TDEE; if/when targets diverge from TDEE (override), this stops being a deficit/surplus signal and becomes a "calories remaining toward target" signal. Re-evaluate the labelling in PR 9 (history charts).
- The home page is intentionally functional-not-pretty. PR 6 (Dashboard) replaces this layout with macro rings, hero numbers, recent activity feed; the data plumbing here should mostly survive that swap.
- `formatTime` uses `toLocaleTimeString([], …)` — picks up the browser's locale + TZ. Once `profile.timezone` is reliably populated, switch to `{ timeZone: profile.timezone }` so the rendering matches across devices.
- Optimistic delete falls back to `refresh()` on error, so a network blip restores state. No toast yet — silent recovery is fine for MVP, revisit when adding error UX globally.

### PR 7 — LLM chat with tool use (2026-05-01)

**What landed.** `apps/api/src/chat/`:
- [`anthropic.ts`](apps/api/src/chat/anthropic.ts) — singleton SDK client + model/effort/max-tokens constants.
- [`tools.ts`](apps/api/src/chat/tools.ts) — four tool definitions (`log_meal`, `log_workout`, `get_daily_summary`, `get_recent_meals`) with zod input schemas; executor map runs each through `forUser()` so RLS applies.
- [`systemPrompt.ts`](apps/api/src/chat/systemPrompt.ts) — `STABLE_PROMPT` (identity, behavior rules, METs reference) split from a per-turn volatile tail (today's date / targets / totals / recent meals).
- [`loop.ts`](apps/api/src/chat/loop.ts) — tool-use loop with 8-iteration cap. Sends `system` as two text blocks with `cache_control: {type: "ephemeral"}` on the stable one so it caches across turns. Sums usage across iterations.
- [`routes.ts`](apps/api/src/chat/routes.ts) — `POST /chat` (sweep > 30 days, gather context, run loop, persist user + assistant rows) and `GET /chat/messages` (recent 200).

Web:
- [`QuickChatInput`](apps/web/components/QuickChatInput.tsx) submits to `/chat`, shows the reply inline, and triggers `onAfterReply` so the dashboard refreshes when tools logged anything. Adds a "full chat →" link.
- [`/chat` page](apps/web/app/chat/page.tsx) — full-screen conversation with optimistic user bubble, Enter-to-send, scroll-to-bottom on new messages.

**Verified.** All 4 packages typecheck (turbo). `POST /chat` and `GET /chat/messages` both 401 without a session cookie. Real Anthropic round-trip needs a logged-in browser test.

**Watch.**
- The system prompt has a stable prefix + a volatile tail. The volatile tail changes every turn (totals, recent meals), but the stable prefix should hit the cache. Verify with `cache_read_input_tokens` in the response usage when testing — if it's zero across consecutive turns, something is invalidating (e.g. a timestamp leaking into `STABLE_PROMPT`).
- Tool input keys are snake_case to match the input_schema (`protein_g`, `consumed_at`). Drizzle inserts use camelCase. The `executeTool` map handles the bridge — keep them in sync if you add a new tool.
- 30-day cleanup runs synchronously on every `POST /chat` for the current user only. Cheap with the user_id index, but if traffic ramps, hoist to a cron job in PR 11.
- The chat loop persists only the final assistant text + tool-call jsonb. The intermediate tool_use/tool_result blocks are NOT persisted — replaying a session with Anthropic would need a re-fetch of context, but our system prompt re-grounds totals each turn so that's fine.
- Loop cap is 8 iterations. If a model gets stuck looping (e.g. hallucinated tool name), it errors out; we surface 502 to the client.

### PR 8 — Recipes (2026-05-02)

**What landed.** `apps/api/src/recipes/routes.ts` — full CRUD plus `POST /recipes/:id/log` for manual recipe logging. All routes go through `forUser()`. The shared schemas in `packages/shared/src/schemas/recipes.ts` were rewritten to camelCase and gained `CreateRecipeInput` / `UpdateRecipeInput`. Three new chat tools in `apps/api/src/chat/tools.ts`: `save_recipe` (createdBy: "llm"), `get_recipes` (substring search on name), `log_meal_from_recipe` (server-side servings × per-serving macros, inserts a meal with `source: "recipe"` and `recipe_id` set).

Web side: `apps/web/lib/api.ts` got `listRecipes`, `createRecipe`, `updateRecipe`, `deleteRecipe`, `logRecipe`. `apps/web/app/recipes/page.tsx` is the recipes UI: search, card grid, create/edit modal with one-line-per-ingredient textarea (`name | quantity` syntax), live macro preview in the log modal, optimistic delete. The "llm" badge marks recipes saved by the assistant. Dashboard header now has a `Recipes` link.

**Verified.**
- `pnpm typecheck` — all 4 packages clean.
- `pnpm --filter @macros/db test` — 12/12 still green.
- All 5 new routes return 401 without a session cookie.

**Watch.**
- Both the manual `POST /recipes/:id/log` and the LLM `log_meal_from_recipe` tool implement the same multiplication. They share `round1()` but the function is duplicated across `recipes/routes.ts` and `chat/tools.ts`. If a third caller appears, hoist this into a `recipes/log.ts` helper.
- The ingredients textarea uses `name | quantity` per line. Save/load round-trips faithfully but loses any structure beyond two fields. Fine for MVP; swap to a proper repeater if users want more shape (servings size, calories per ingredient, etc.).
- Recipe delete is hard delete — meals previously logged via that recipe keep their copied macros (description includes the recipe name), and `meal.recipe_id` is set to NULL by the FK's `ON DELETE SET NULL`. Worth confirming the home activity feed still renders those orphaned meal rows correctly.
- The chat system prompt does NOT mention recipes explicitly. Add a "Use saved recipes when the user references a meal by name" hint to `STABLE_PROMPT` if the model under-uses `get_recipes` in practice.

### PR 9 — History + charts (2026-05-02)

**What landed.** `apps/api/src/history/routes.ts` — `GET /history?from=&to=&timezone=` returns daily aggregates (calories consumed, P/C/F, calories burned) plus the user's targets. Aggregation happens in Postgres via `((consumed_at) AT TIME ZONE $tz)::date::text` so day boundaries respect the user's local time. Resolves timezone from query param → profile.timezone → UTC. UTC bounds are padded by ±1 day to avoid clipping at the local-day edge; the SQL grouping reins everything back to the requested range. Server caps requests at 366 days.

Web: `apps/web/lib/api.ts` got `getHistory()` and a typed `HistoryResponse`. `apps/web/lib/dates.ts` gained `lastNDaysRange()` and `browserTimezone()`. `apps/web/app/history/page.tsx` is the page: 7d / 30d / 90d / custom preset toggle, summary stat row (avg consumed in accent, avg burned, avg P / C / F), three Recharts panels — calorie line with target ReferenceLine, stacked macro bar (pink-400 / blue-400 / amber-400), net-vs-target bar with cells colored accent when negative (deficit) and red when positive (surplus). Empty target shows a "go set a calorie target in Settings" nudge. Dashboard header gets a History link.

**Verified.** Full `pnpm typecheck` clean. `/history` returns 401 without a session.

**Watch.**
- Server-side aggregation produces strings for the day field (`::date::text`). Client coerces values to `Number()` defensively because postgres-js returns numerics as strings in some configs — already happens here.
- Custom date-range inputs use the native `<input type="date">`. Cross-browser styling is uneven; if the picker UX matters, swap to a datepicker library.
- Net-vs-target chart hides if no calorie target is set (replaces the chart body with the Settings link). Macro net comparisons could follow the same model later.
- The `MAX_RANGE_DAYS = 366` cap exists for safety; bumping it requires verifying Recharts doesn't choke on >1000 data points (right now the grid rendering is fine to ~120).
- Targets in the response are *base* targets (no workout-burn bonus). For per-day budget visualization that accounts for that day's workouts, do the math client-side per row.

### PR 10 — Polish (2026-05-02)

**What landed.**
- `apps/web/app/layout.tsx`: Geist + Geist Mono via `next/font/google` (variables flow through `--font-geist` / `--font-geist-mono`), inline no-flash theme script, body `font-sans` applied. `<html suppressHydrationWarning>` so the manual class toggle doesn't trigger React's mismatch warning.
- `apps/web/app/globals.css`: Tailwind v4 `@variant dark (&:where(.dark, .dark *))` so `dark:` modifiers respond to the class toggle (not just `prefers-color-scheme`). Reset color-scheme handling: light by default, `.dark` flips it.
- `apps/web/components/BottomNav.tsx`: fixed bottom nav with five icons (Today / Chat / Recipes / History / Settings), `md:hidden`, returns null on `/login`, `/auth/callback`, `/chat`. Inline SVG icons, no extra dep. Active route in accent color.
- `apps/web/components/ThemeToggle.tsx`: light / system / dark toggle group; system mode removes the storage key and reads `prefers-color-scheme`. Wired into Settings.
- Page-level: every protected page now has `pb-24 md:pb-10` to clear the fixed nav. Header link rows on the dashboard collapse to a logo + email-shortcut on mobile (the bottom nav owns navigation). Sign out moved to Settings.

**Verified.** All 4 packages typecheck. SSR on `/login` shows the inline theme script in `<head>`, `font-sans` body class, and the next/font CSS-variable classnames on `<html>`. SSR on `/` includes the BottomNav with `md:hidden` + `inset-x-0 bottom-0` markers (so it shows on mobile and hides at md+).

**Watch.**
- Tailwind v4 dropped the implicit `darkMode: 'class'` config in favor of explicit `@variant`. The directive in `globals.css` is the single source of truth; if you add another stylesheet, repeat the variant declaration there.
- The no-flash theme script depends on `localStorage` and `matchMedia` being defined synchronously at first paint. SSR renders without the `dark` class — the script fires immediately on hydration to add it. The `suppressHydrationWarning` on `<html>` is needed for this exact reason; don't remove it.
- BottomNav uses `<a href>` not `<Link>` — full page transitions, but simpler. Swap to `next/link` if route prefetching matters once the app is live.
- The mobile dashboard header truncates the email link aggressively. On very long emails the click target gets tiny; consider replacing with an avatar circle later.
- `/chat` opts out of BottomNav. That means the only mobile escape is the `← macros` link in its header. If users get lost there, add the BottomNav back with a higher input z-index.

### PR 11 — Deploy (2026-05-02)

**What landed.** Production-ready codebase + the platform configuration to deploy it:

- API runtime simplified to `tsx src/index.ts` — no separate `tsc` build step, no `dist/`. Cold-start is fast enough for an MVP, and it removes the monorepo "what gets bundled" question.
- `/healthz` route in [server.ts](apps/api/src/server.ts) executes `select 1` through the DB pool; Railway uses it for healthchecks. `/health` remains for liveness-only checks.
- Fastify boots with `trustProxy: true` in production so request IP and protocol come from `X-Forwarded-*` headers rather than the inner Railway socket.
- Cookies: `secure` flips on in production. `Domain` attribute is now opt-in via the new optional `COOKIE_DOMAIN` env (leave unset behind a same-origin proxy).
- `apps/web/next.config.ts` rewrites `/api/:path*` to `process.env.API_PROXY_TARGET` when set. With `NEXT_PUBLIC_API_URL=/api` in Vercel, the browser sees one origin (`macros.dalty.io`) — no CORS, no cross-domain cookie config.
- Stytch OAuth base URL is now detected from the `public-token-live-` vs `public-token-test-` prefix in [login/page.tsx](apps/web/app/login/page.tsx). One build, both environments.
- [`apps/web/vercel.json`](apps/web/vercel.json) sets the install + build commands so Vercel handles the pnpm monorepo correctly. Root directory is `apps/web`.
- [`railway.toml`](railway.toml) + [`nixpacks.toml`](nixpacks.toml) at the repo root. Nixpacks installs corepack-pinned pnpm, runs `pnpm install --frozen-lockfile`, then on start runs `pnpm --filter @macros/db db:migrate && pnpm --filter @macros/api start`. Migrations run on every deploy.
- [`DEPLOY.md`](DEPLOY.md) is the full runbook: prereqs, Railway setup with env vars, Vercel setup with rewrite + env vars, DNS for `macros.dalty.io`, Stytch live config, end-to-end smoke test, common ops (manual migration, log tailing, rollback).

**Verified.**
- `pnpm typecheck` clean across 4 packages.
- `pnpm --filter @macros/db test` — 12/12 still green.
- `/login` SSRs 200 in dev.
- `/healthz` returns 200 with `{status:"ok",db:"ok"}`.

**Watch.**
- Migrations run on every deploy. They're additive and idempotent today, but a destructive migration would run automatically. If a future migration drops a column or rewrites data, gate it behind a manual one-shot job (Railway → Run command → `pnpm --filter @macros/db db:migrate`) and remove the auto-run from `nixpacks.toml`.
- The Vercel rewrite means Vercel's edge fronts every API call. Vercel function execution time counts toward your plan; for hot endpoints with high QPS, consider giving the API a public hostname (`api.macros.dalty.io` CNAME directly to Railway) and dropping the rewrite.
- Stytch redirect URLs must be configured in **both** projects (Test + Live) before the corresponding deploy can authenticate. The Test project still drives previews and dev.
- `SESSION_SECRET` rotation: documented in DEPLOY.md, but worth saying again — it invalidates every active session cookie. Plan a rotation when traffic is low.
- `COOKIE_DOMAIN` is unset by default. If you ever move to a separate `api.macros.dalty.io` (no rewrite), set this to `.macros.dalty.io` so the cookie is shared across the apex and api subdomains. Otherwise leave it.
- Railway's Postgres add-on creates the `macros` superuser by default. Migration `0002_app_role.sql` creates the non-super `app_user` role idempotently — verify it ran by checking `pg_roles` (instructions in DEPLOY.md §1.8).
- Anthropic SDK uses one API key for all environments. If you want billing visibility per env, create separate Anthropic workspaces and rotate the key in each Railway environment.

### PR 6 — Dashboard (2026-05-01)

**What landed.** Three new components in `apps/web/components/`:
- [`MacroRing.tsx`](apps/web/components/MacroRing.tsx) — SVG ring (120px, 8px stroke, animated dashoffset). Track is zinc-200/800, fill is `--color-accent` for the calorie ring and zinc-400 for macros, switches to red when overshooting. Big tabular-nums center number with `/ target` subtitle, capitalized label below.
- [`ActivityFeed.tsx`](apps/web/components/ActivityFeed.tsx) — merges `meals` + `workouts` by timestamp, slices to 10. Each row: time / colored dot / title / detail / hover-only delete ✕. Meals use accent dot, workouts an outlined dot.
- [`QuickChatInput.tsx`](apps/web/components/QuickChatInput.tsx) — textarea with Enter-to-send, hint line. Submission shows a "coming next PR" hint; real chat lands in PR 7.

`apps/web/app/page.tsx` rebuilt around these: hero "remaining kcal" number, four-up rings grid (collapses to 2x2 on mobile), chat input, activity feed, manual log forms hidden behind a `+ Log manually` toggle. Used the previously-discovered fetch-wrapper fix so deletes don't 400.

**Verified.** `pnpm --filter @macros/web typecheck` clean. Page SSRs to the loading shell (correct without cookie). Browser-side verification in user's hands.

**Watch.**
- `MacroRing` overshoot threshold is 1.0 — anything above target shows red. If users want "approaching target" warnings before overshoot (e.g. 90%), add a third state.
- The chat input intercepts Enter inside the textarea. If we later want multi-line by default and Cmd+Enter to send, swap the key handler.
- Activity feed's delete ✕ uses `opacity-0 group-hover:opacity-100`. On touch devices that have no hover, the button only becomes visible on focus (also handled). If touch UX feels broken, switch to always-visible.
- Manual forms inside the collapsed section duplicate the post-create `onCreated -> refresh` plumbing from PR 5. They'll likely be removed entirely once chat handles the happy path; for now they're the documented escape hatch.
