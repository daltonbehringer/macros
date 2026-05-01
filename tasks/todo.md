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

## Step 2 — Stytch auth end-to-end (PR 3)

- [ ] `apps/api/src/auth/stytch.ts` — magic link send + authenticate
- [ ] `apps/api/src/auth/google.ts` — OAuth start + callback
- [ ] Session middleware: validates Stytch session cookie, attaches `req.userId`, sets PG GUC at start of request
- [ ] On first auth for an unknown `stytch_user_id`: insert `users` row + empty `user_profiles`
- [ ] `apps/web/app/login/page.tsx` — magic link form + Google button
- [ ] `apps/web/app/auth/callback/page.tsx` — token exchange
- [ ] `GET /me` returns current user + profile, used to gate protected routes
- [ ] Stytch dashboard: redirect URLs for `localhost:3000`, `*.vercel.app`, `macros.dalty.io`

## Step 3 — Settings + TDEE (PR 4)

- [ ] `/settings` page: height, weight, age, sex, activity level, unit system
- [ ] BMR via Mifflin-St Jeor; TDEE = BMR × activity multiplier
- [ ] Derived macro defaults: protein `0.8 × weight_lb`, fat `0.25 × TDEE / 9`, carbs fill remainder
- [ ] Manual override fields for daily calorie / protein / carbs / fat targets
- [ ] "How we calculate your targets" expandable section showing the math
- [ ] Delete-all-data button: typed-DELETE confirmation, deletes from every user-scoped table including `chat_messages`

## Step 4 — Manual logging (PR 5)

- [ ] `POST /meals`, `DELETE /meals/:id`, `GET /meals?date=` — manual entry path, no LLM yet
- [ ] `POST /workouts`, `DELETE /workouts/:id`, `GET /workouts?date=`
- [ ] All inputs validated with zod, all queries via `db.forUser(userId)`
- [ ] Quick-add forms on dashboard

## Step 5 — Dashboard (PR 6)

- [ ] Today's macro rings (calories + 3 macros) with accent color on calorie ring
- [ ] Calories remaining = target − consumed + active workout burn
- [ ] Recent activity feed (last 10 meals + workouts merged, sorted desc)
- [ ] Quick chat input (Enter submits, opens chat drawer with the message)
- [ ] Tabular nums everywhere numeric

## Step 6 — LLM chat with tool use (PR 7)

- [ ] Tools: `log_meal`, `log_workout`, `get_daily_summary`, `get_recent_meals`, `save_recipe`, `get_recipes`
- [ ] Anthropic SDK with current model (verify latest at runtime — likely `claude-sonnet-4-5` or successor)
- [ ] System prompt template includes: today's date (in user TZ), daily targets, today's running totals, last 7 days of meals, METs reference for workout sanity-check
- [ ] Tool-use loop: execute tools server-side, append `tool_result`, loop until plain text
- [ ] Persist user message + tool calls + assistant message to `chat_messages`
- [ ] `/chat` page (full screen on mobile, drawer on desktop)
- [ ] Cleanup job: delete `chat_messages` older than 30 days (cron via Railway scheduled job, or on-write trim)

## Step 7 — Recipes (PR 8)

- [ ] `/recipes` list/create/edit/delete UI
- [ ] LLM `save_recipe` and `get_recipes` tools wired
- [ ] Recipe → meal logging path (multiply by servings)

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
