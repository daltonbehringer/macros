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

## Step 8 — History + charts (PR 9)

- [ ] `/history` with date range picker (day / week / month / custom)
- [ ] Recharts: calorie trend line, macro stacked bar, deficit/surplus over time
- [ ] Custom theming matching app accent color, tabular nums on tooltips

## Step 9 — Polish (PR 10)

- [ ] Mobile responsive pass — test at 375px, bottom nav bar
- [ ] Dark mode pass — every screen, both themes
- [ ] Typography: Geist + Geist Mono via `next/font`
- [ ] Pick + apply accent color (proposing electric green; confirm before applying)

## Step 10 — Deploy (PR 11)

- [ ] Vercel project: root `apps/web`, env vars per environment
- [ ] Railway: service for `apps/api` + Postgres add-on, dev + prod environments
- [ ] Stytch: Test keys for dev/preview, Live keys for prod
- [ ] DNS: `macros.dalty.io` → Vercel; CORS allowlist on api
- [ ] Smoke test: register → log meal via chat → see on dashboard, in prod

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
