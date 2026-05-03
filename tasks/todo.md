# Macros MVP — Build Plan

Sequencing follows the spec's build order with concrete checkable items. Each section is roughly one PR.

> **Phase 1** is complete (PRs 1–11, see Review section). **Phase 2** is the pre-launch slate: dev/prod environment split, then a sequenced PR backlog (landing page → onboarding → analytics → PWA → chat quota → error tracking → weekly email).

---

## Phase 2 — Dev/prod split + pre-launch PRs

### Step 0 — Clean dev/prod environments (PR 12) ⏳

Decisions (confirmed with user 2026-05-02):
- Vercel: long-running `develop` branch, aliased to `dev.macros.dalty.io`
- Migrations: auto-run on dev (current behavior), **manual** on prod (override Railway start command)
- Railway dev env named `dev`
- Stytch: keep Test for both dev + prod until launch; defer Live setup

Tasks:
- [ ] Create local `develop` branch from `main`
- [ ] Update [`nixpacks.toml`](nixpacks.toml) — keep auto-migrate as the default start (dev behavior); document prod override in DEPLOY.md
- [ ] Rewrite [`DEPLOY.md`](DEPLOY.md) to cover dev + prod side-by-side (per-env tables, click-through for `dev` env on Railway, Vercel `develop` branch + `dev.macros.dalty.io` alias setup, Stytch redirect URL additions)
- [ ] Add a "Migration policy" section to DEPLOY.md (auto on dev / manual on prod via Railway start-command override)
- [ ] User actions: provision Railway `dev` env + Postgres add-on, configure Vercel `develop` branch, point `dev.macros.dalty.io` CNAME, override Railway prod start command, add dev redirect URLs to Stytch Test
- [ ] Verify dev → vercel preview → Railway dev DB end-to-end before starting PR 13

### PR 13 — Public landing page at `/`

Logged-out visitors currently get pushed to `/login`. Replace with a real landing page (tagline, screenshot/animated demo, 3-step "talk → log → see", CTA → `/login`). Authenticated users still land on the dashboard. Use frontend-design skill. Geist + electric-green accent. Mobile-responsive at 375px.

### PR 14 — First-run onboarding

3-step inline flow when profile is empty (sex/age/activity → height/weight/units → confirmation with computed targets). Reuse Settings input components. Persists via existing `PUT /profile`.

### PR 15 — Analytics (Plausible vs Vercel Analytics — TBD)

Track: page views, `signup_completed`, `onboarding_completed`, `meal_logged_via_chat`, `meal_logged_manual`, `workout_logged`, `delete_account`. Document events in DEPLOY.md.

### PR 16 — PWA basics

`apps/web/public/manifest.json`, 192/512 icons (check git history of Python prototype or generate from accent logo), iOS/Android meta tags in `app/layout.tsx`. No service worker yet.

### PR 17 — Per-user daily chat quota

30 messages/day cap with soft warning at 25, hard 429 at 30. Tracked via count of `chat_messages` for the user that local day. Subtle remaining-count surface in chat UI.

### PR 18 — Sentry-or-equivalent error tracking

Free tier. Wire web + api. No PII (no message content, no emails — user IDs OK).

### PR 19 — Weekly summary email — **DEFERRED (2026-05-02)**

Plan captured in [`tasks/pr19-weekly-email-plan.md`](pr19-weekly-email-plan.md). Re-engagement nice-to-have; deprioritized in favor of getting first users on Phase 2 surfaces. Schema migration is a clean additive change when picked back up — no rework needed.

---

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

### PR 18 — Sentry error tracking (2026-05-02)

**What landed.** Runtime error visibility on both apps. Sentry SDKs initialized with strict PII scrubbing (request bodies, cookies, auth headers, URL tokens). Errors only — no performance/tracing/replay. Free tier 5k/month is enough for an MVP.

- **`apps/web` (Next.js)**: `@sentry/nextjs@^10.51`. Five files added:
  - [`apps/web/sentry.client.config.ts`](apps/web/sentry.client.config.ts) — browser SDK init, `beforeSend` + `beforeBreadcrumb` scrubbing
  - [`apps/web/sentry.server.config.ts`](apps/web/sentry.server.config.ts) — SSR SDK init
  - [`apps/web/sentry.edge.config.ts`](apps/web/sentry.edge.config.ts) — Edge runtime init (covers layout's cookie read)
  - [`apps/web/instrumentation.ts`](apps/web/instrumentation.ts) — Next.js convention; `register()` loads server/edge config based on runtime; `onRequestError = Sentry.captureRequestError` forwards App Router thrown errors
  - [`apps/web/next.config.ts`](apps/web/next.config.ts) — wrapped with `withSentryConfig()`. Source-map upload to Sentry on every prod build (gated on `SENTRY_AUTH_TOKEN` — local builds without it skip the upload step). `sourcemaps.deleteSourcemapsAfterUpload: true` keeps the maps off the public bundle.
- **`apps/api` (Fastify)**: `@sentry/node@^10.51`. Three changes:
  - [`apps/api/src/sentry.ts`](apps/api/src/sentry.ts) — `initSentry()` with the same PII-scrubbing `beforeSend` + `beforeBreadcrumb`. No-ops cleanly when `SENTRY_DSN` is empty.
  - [`apps/api/src/index.ts`](apps/api/src/index.ts) — `import { initSentry } from "./sentry"; initSentry();` as the **very first** lines. Sentry's auto-instrumentation hooks Node's module system at init time; reordering these breaks instrumentation silently.
  - [`apps/api/src/server.ts`](apps/api/src/server.ts) — `setErrorHandler` hook. Captures 5xx exceptions via `Sentry.withScope`, attaches the user id (if present) for correlation, never the email. 4xx are skipped — those are expected user errors, not bugs.
- **PII scrubbing** (both SDKs): `event.request.data` (chat messages live here), `event.request.cookies`, `Cookie` + `Authorization` headers, `event.user.email`, and `token` / `stytch_token_type` query params on URLs.
- [`apps/api/.env.example`](apps/api/.env.example) + [`apps/web/.env.example`](apps/web/.env.example) — added `SENTRY_DSN`, `SENTRY_ENV`, plus `NEXT_PUBLIC_SENTRY_DSN` and the build-time trio (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) on the web side.
- [`DEPLOY.md`](DEPLOY.md) §4d — Sentry setup steps (create two projects, copy DSNs, generate auth token), per-env variable matrix on Vercel + Railway, what's scrubbed, what's intentionally not done.
- [`package.json`](package.json) — added `pnpm.peerDependencyRules.allowAny: ["@opentelemetry/api"]` to dedupe drizzle-orm. Without it, Sentry's transitive `@opentelemetry/api` triggered a peer-variant split, creating two incompatible drizzle-orm copies. (Captured as a lesson in [`tasks/lessons.md`](tasks/lessons.md).)

**Verified.**
- `pnpm typecheck` clean across 4 packages.
- Local API + web both return 200 (`/healthz`, `/`) with empty DSNs — SDKs no-op as designed.
- No new local boot warnings, no Sentry-related errors in dev console.

**Watch.**
- **Init order in api/index.ts is load-bearing**: `initSentry()` MUST run before any other import. Sentry's instrumentation hooks `require()` and won't catch modules already loaded. If a future refactor moves the env import or schema import above the Sentry call, instrumentation breaks silently.
- **Source maps for the api are intentionally NOT uploaded**. `tsx` runs TypeScript directly, no build step, no maps to upload. Stack traces in Sentry will show TS line numbers natively — fine for our case. If we ever switch to a built `dist/`, add `@sentry/node` source-map upload via the CLI.
- **5xx-only capture in the Fastify error hook**: 4xx (validation, auth) are user-actionable signals, not bugs — capturing them would burn quota on noise. If a 4xx ever masks a real bug (e.g., a malformed validation schema), it'll silently 400 without a Sentry event. Acceptable trade.
- **`SENTRY_AUTH_TOKEN` on Vercel** is a *build-time* secret. If it ever leaks into a client bundle (e.g., via `NEXT_PUBLIC_*` prefix typo), it would let anyone upload source maps to your Sentry project. Don't prefix it.
- **Dev + prod can share Sentry projects** (recommended interim — events are tagged with `environment`, filter in the UI). Splitting later is just creating new projects + swapping the env vars on prod. Until traffic separates dev noise from prod signal, share.
- **The `peerDependencyRules` block in `package.json`** is now load-bearing. If you ever delete it, Sentry's transitive `@opentelemetry/api` will re-split drizzle-orm and `pnpm typecheck` will fail with cryptic "PgColumn is not assignable to Aliased" errors. The lesson in `tasks/lessons.md` documents the full diagnosis.
- **No release tagging by git SHA** (`SENTRY_RELEASE`). Could add later for "this error first appeared in commit X" filtering in Sentry. Defer until needed.
- **No alert routing in code** — set up Slack/email digests directly in Sentry's UI (Settings → Alerts).

### PR 17 — Per-user daily chat quota (2026-05-02)

**What landed.** Server-enforced cap of 30 user-role chat messages per local day per user, surfaced subtly in both chat UIs. Protects against runaway Anthropic spend before pricing exists.

- [`packages/shared/src/schemas/chat.ts`](packages/shared/src/schemas/chat.ts) — new `ChatQuota` type (`remaining`, `limit`, `resetsAt` ISO). Server is sole source of truth for `limit` so changing the cap is a server-only deploy.
- [`apps/api/src/chat/quota.ts`](apps/api/src/chat/quota.ts) — `DAILY_LIMIT = 30`, `getQuotaForUser(tx, userId, timezone)`. Computes "today 00:00 in tz" as a UTC moment via Postgres tz arithmetic, counts user-role `chat_messages` since that boundary, returns `{ remaining, limit, resetsAt }`. Timezone validated against `Intl.supportedValuesOf("timeZone")` before being inlined via `sql.raw` (avoids the Drizzle param-dedup gotcha documented in lessons.md).
- [`apps/api/src/chat/routes.ts`](apps/api/src/chat/routes.ts):
  - **Pre-flight in `POST /chat`**: a small `forUser` block reads timezone + computes quota *before* calling Anthropic. If `remaining <= 0`, returns 429 `{ error: "rate_limited", quota }`. No Anthropic call, no token spend.
  - **Post-process**: re-fetches quota after the user message persists so the response carries a fresh counter (saves the client a roundtrip).
  - **New `GET /chat/quota`** endpoint so the UI can show the counter on mount, before the user's first send of the day.
- [`apps/web/lib/api.ts`](apps/web/lib/api.ts) — `ApiError` gained an optional `data` field that carries the parsed JSON response body. Lets specific handlers (like the 429 path) read structured payloads without a second fetch. `sendChat` return type now includes `quota`; `getChatQuota()` added.
- [`apps/web/components/QuickChatInput.tsx`](apps/web/components/QuickChatInput.tsx) — fetches quota on mount, displays inline in the footer hint (`Enter to send · ... · 27/30 today`). Below `WARN_THRESHOLD = 5` the counter goes amber. At 0: textarea + Send disabled, placeholder/error explains the reset and points users at the manual-log escape hatch ("You can still log meals and workouts manually").
- [`apps/web/app/chat/page.tsx`](apps/web/app/chat/page.tsx) — same quota fetch + 429 handling. Counter rendered as a small mono right-aligned strip below the input. Same disabled-state behavior. (User refined the 429 copy mid-session to add the manual-log escape hatch line; QuickChatInput's copy was updated to match.)

**Verified.**
- `pnpm typecheck` clean across 4 packages.
- `GET /chat/quota` returns 401 without a session cookie (auth guard intact).
- Browser smoke: counter renders on mount, decrements after each send, color shifts amber within 5 of the cap.

**Watch.**
- **Race**: two concurrent `POST /chat` calls can both pass pre-flight (count reads before either persists). Worst case: the 31st message slips through. Cost = one extra Anthropic call. Not worth a `SELECT FOR UPDATE` for MVP. If it ever matters, the fix is wrapping pre-flight + insert in a single transaction with row-level locking on `chat_messages` for that user.
- **Tool iterations don't bill against quota**: a single chat turn that fires 5 tool calls still counts as 1 user message. Correct for "user sent a message" semantics but means a tool-heavy day is *cheaper* on quota than a chatty day. If we ever want token-cost-based limits, that needs a separate accounting path.
- **Timezone changes mid-day**: a user moving from PST → EST (or just changing the field in Settings) shifts the quota window. They could theoretically reset their day by jumping forward 24h. Acceptable edge — not a real abuse vector in normal use.
- **DST boundary days** are handled by Postgres tz math correctly. Spring-forward day = 23-hour window; fall-back = 25-hour. No code awareness needed.
- **Server is the only place `DAILY_LIMIT` is defined** — clients receive `limit` from API responses and never assume. Changing the cap is one constant in `chat/quota.ts` + restart, no client deploy. If we add a paid tier later, the field becomes per-user and reads from the user record instead of a constant.
- The `ApiError.data` field is now generically available to all callers. Most callers can ignore it (the existing `instanceof ApiError && status === 401` pattern still works untouched). Use it sparingly — it's there for cases where the server sends a structured payload alongside the error code.
- `WARN_THRESHOLD = 5` is duplicated in both QuickChatInput and the chat page. If we ever want to tune it, both need updating. Could hoist to shared but it's purely client-side cosmetic — not worth the import path until there's a third caller.

### PR 16 — PWA basics (2026-05-02)

**What landed.** "Add to Home Screen" works on iOS + Android, opens in standalone mode (no browser chrome), branded with the app icon. No service worker, no offline mode, no push notifications.

- [`apps/web/components/branding/Mark.tsx`](apps/web/components/branding/Mark.tsx) — single source of truth for the icon: bold lowercase "m" in accent green (`#00e08a`) on near-black (`#0a0a0b`), rendered via plain JSX with inline styles. Designed for `next/og`'s `ImageResponse` — uses `system-ui` to avoid font-fetching cost; takes a `size` prop and scales font size + optical-centering padding from it.
- [`apps/web/app/icon.tsx`](apps/web/app/icon.tsx) — 32×32 favicon. Auto-conventions to `<link rel="icon">`.
- [`apps/web/app/apple-icon.tsx`](apps/web/app/apple-icon.tsx) — 180×180 iOS apple-touch-icon. Auto-conventions to `<link rel="apple-touch-icon">`.
- [`apps/web/app/icons/192/route.tsx`](apps/web/app/icons/192/route.tsx) + [`apps/web/app/icons/512/route.tsx`](apps/web/app/icons/512/route.tsx) — custom GET handlers returning 192×192 / 512×512 PNGs for the PWA manifest. Stable URLs (no Next.js asset hash) so the manifest can reference them statically.
- [`apps/web/app/manifest.ts`](apps/web/app/manifest.ts) — Next.js manifest convention. `display: standalone`, `start_url: /`, theme + bg colors set to near-black, both icons declared with `purpose: any`. Auto-served at `/manifest.webmanifest`.
- [`apps/web/app/layout.tsx`](apps/web/app/layout.tsx) — added `appleWebApp` metadata (`title: "Macros"`, `capable: true`, `statusBarStyle: black-translucent`) and a scheme-matched `viewport.themeColor` (white in light, near-black in dark) so the browser/OS chrome blends with the page rather than fighting it.

No new deps. No PNG files in git. Single component drives every icon.

**Verified.**
- `pnpm typecheck` clean across 4 packages.
- All five PWA endpoints return correctly:
  - `GET /manifest.webmanifest` → 200, `application/manifest+json`, valid JSON
  - `GET /icon` → 200, `image/png`, 391b
  - `GET /apple-icon` → 200, `image/png`, 1.9 KB
  - `GET /icons/192` → 200, `image/png`, 1.9 KB
  - `GET /icons/512` → 200, `image/png`, 6.7 KB
- Page head emits all expected tags: `<link rel="manifest">`, `<link rel="icon" sizes="32x32">`, `<link rel="apple-touch-icon" sizes="180x180">`, both scheme-scoped `<meta name="theme-color">`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`.

**Watch.**
- Next.js 14+ emits `<meta name="mobile-web-app-capable">` (the modern unprefixed name) instead of the legacy `apple-mobile-web-app-capable`. Modern iOS (15+) honors the unprefixed form. iOS 14 and below might not enable standalone mode — fringe slice; not worth the bloat of a manual `<meta>` override.
- The Mark component uses `system-ui` rather than Geist. `ImageResponse` from `next/og` requires fonts to be fetched via the `fonts: [...]` option — adds ~100 KB to the cold-start cost per icon route. System fonts render the lone "m" cleanly enough at every size we ship; if we ever want pixel-perfect Geist parity, swap to `fonts: [{ data: ..., name: 'Geist' }]`.
- `/icons/192` and `/icons/512` are non-cached by default in the route handler. Vercel's edge will cache them (the response has no `Cache-Control` header, so it's the default), but if traffic ramps and these get hit hard, add `export const revalidate = 31536000` to make caching explicit.
- The mark is square. iOS 14+ rounds corners automatically; Android handles its own shape per launcher. Not a maskable icon (no `purpose: maskable` slot in the manifest), so on Android launchers that crop aggressively, the "m" might get clipped on the edges. Defer adaptive/maskable until the design settles.
- "Macros" is the home-screen label on iOS via `appleWebApp.title` and on Android via `manifest.short_name`. If we rebrand later, both update from the same two places.
- `start_url: '/'` means installed-app launches go to the landing page (when logged out) or the dashboard (when logged in) — matches web behavior. If we ever want a different launch target for installed users (e.g. `/?source=pwa`), this is where to set it.
- Splash screens not configured. iOS uses a default white/dark splash with the icon centered. If we want custom artwork, the iOS API needs a long list of `apple-touch-startup-image` link tags per device size — tedious; defer.
- Real-device install + launch flow is **not yet verified** — needs a phone test on `dev.macros.dalty.io` after deploy. Open the URL in mobile Safari/Chrome → Share → Add to Home Screen → tap the icon → confirm it launches in standalone (no browser chrome) with the correct icon.

### PR 15 — Vercel Analytics (2026-05-02)

**What landed.** Privacy-friendly, cookie-free web analytics via Vercel. Page views automatic; six custom events fire at key activation moments. No PII (no user IDs, emails, or message content). Per the "save events, log essentials" guidance: each chat-tool firing emits at most one event per kind per turn (logging three meals in one chat message counts as one), no per-event properties anywhere.

- [`apps/web/lib/analytics.ts`](apps/web/lib/analytics.ts) — typed wrapper. The `EventName` union is the single source of truth — using an unlisted name anywhere is a typecheck error. `track()` swallows network/ad-blocker failures so analytics issues never reach the UI. `trackChatToolCalls(calls)` inspects the chat result and fires `meal_logged_via_chat` and/or `workout_logged` once per kind per turn.
- [`apps/web/app/layout.tsx`](apps/web/app/layout.tsx) — `<Analytics />` from `@vercel/analytics/next` mounted at the body. Records page views automatically. Local dev is auto-disabled by the SDK (`mode="auto"` no-ops on `localhost`).
- [`apps/web/app/auth/callback/page.tsx`](apps/web/app/auth/callback/page.tsx) — fires `signup_completed` heuristically: after a successful auth round-trip, calls `/me` and fires the event only if `needsOnboarding(profile) === true`. Returning users with a fresh-deleted account will also fire — accepted conflation rather than a server-side `created: true` flag.
- [`apps/web/components/onboarding/OnboardingFlow.tsx`](apps/web/components/onboarding/OnboardingFlow.tsx) — fires `onboarding_completed` after the PUT, before the `/?focus=chat` redirect.
- [`apps/web/components/QuickChatInput.tsx`](apps/web/components/QuickChatInput.tsx) + [`apps/web/app/chat/page.tsx`](apps/web/app/chat/page.tsx) — both call `trackChatToolCalls(result.toolCalls)` after a successful chat reply.
- [`apps/web/components/Dashboard.tsx`](apps/web/components/Dashboard.tsx) — `MealForm` fires `meal_logged_manual`; `WorkoutForm` fires `workout_logged`.
- [`apps/web/app/settings/page.tsx`](apps/web/app/settings/page.tsx) — fires `delete_account` after the API call succeeds, before the navigation away.
- [`DEPLOY.md`](DEPLOY.md) — new §4c documenting the event vocabulary, the dashboard enable step (Vercel project → Analytics tab → Enable Web Analytics), Hobby tier 2,500 events/month quota, and the cookie-free / no-PII privacy stance.
- `apps/web/package.json` — `@vercel/analytics` added.

**Verified.**
- `pnpm typecheck` clean across 4 packages.
- All routes (`/`, `/onboarding`, `/settings`, `/chat`) still 200 in local dev.
- SDK confirmed dev-aware: no `va.vercel-scripts.com` script tags appear in SSR HTML on localhost. Real beacons will only start firing post-deploy on `dev.macros.dalty.io` once Web Analytics is enabled in the dashboard.

**Watch.**
- The single typed wrapper in [`apps/web/lib/analytics.ts`](apps/web/lib/analytics.ts) is the **only** sanctioned way to send events. Adding a new event = add a name to the `EventName` union, then call `track('your_name')`. Don't import from `@vercel/analytics` directly elsewhere — the wrapper's try/catch is what makes analytics non-blocking.
- Hobby tier quota is 2,500 events/month. For an MVP that's plenty, but the **page-view firehose** is the most likely thing to overshoot first since every navigation counts. If traffic ramps and you're approaching the cap, the Custom Events panel in the Vercel dashboard will tell you which slice to trim (e.g., sample non-essential pages via `<Analytics beforeSend={...} />`).
- `signup_completed` heuristic vs reality: it fires whenever `needsOnboarding === true` after auth. Edge case: a user who deletes their account and re-signs-in will fire it twice in their lifetime. If that distinction matters for funnel math, swap to a server-side flag returned from `/auth/authenticate`. Not worth doing now.
- `delete_account` fires before the `/login` redirect specifically so the SDK's beacon has a chance to send before navigation. If we ever switch to `router.push` (no full nav) the explicit ordering becomes irrelevant; if we add other "fire then navigate" patterns, follow this same shape.
- Chat-vs-manual workout split is **not** in the events. Adding `{ source: 'chat' | 'manual' }` later is a 2-line change at the two call sites — defer until you actually want to chart it.
- `<Analytics />` is mounted in the root layout, which means it's loaded on the **landing page** too — a logged-out visitor's page view counts toward your quota. That's intentional (you want to know how the landing performs), but worth noting if you're surprised by event volume.
- Vercel Speed Insights (Core Web Vitals) is a separate package and quota — not included. Add `@vercel/speed-insights` only if performance becomes a concern.

### PR 14 — First-run onboarding (2026-05-02)

**What landed.** A 3-step inline onboarding flow that fresh users hit after signing up, before they see the dashboard. Designed to feel like 30 seconds of work, not a settings page.

- [`packages/shared/src/macros.ts`](packages/shared/src/macros.ts) — new `needsOnboarding(profile)` helper. Returns true iff all five identity fields (`weightKg`, `heightCm`, `age`, `sex`, `activityLevel`) are null. `unitSystem` and `timezone` intentionally excluded — both have defaults set on row creation, so checking them would always return false.
- [`apps/web/components/profile/inputs.tsx`](apps/web/components/profile/inputs.tsx) — new shared module. Extracted `ToggleGroup`, `NumberInput`, `WeightInput`, `HeightInput`, and the `ACTIVITY_OPTIONS` constant from Settings so both Settings and Onboarding share the same input components. No behavior change for Settings.
- [`apps/web/app/onboarding/page.tsx`](apps/web/app/onboarding/page.tsx) — new route. Thin wrapper around `OnboardingFlow`.
- [`apps/web/components/onboarding/OnboardingFlow.tsx`](apps/web/components/onboarding/OnboardingFlow.tsx) — the 3-step state machine. Editorial layout: progress bar (3 dashes that fill accent green as you advance), mono eyebrow `01 / 03 · About you`, big editorial question, focused input cluster, "Next →" / "← Back" CTAs.
  - **Step 1 — About you**: sex toggle, age number input, activity level as a vertical stack of radio cards (label + one-line hint). Next disabled until all three set.
  - **Step 2 — Your body**: units toggle, height (respects units), weight (respects units). Next disabled until height + weight set.
  - **Step 3 — Your targets**: 4 stat tiles showing computed calories / P / C / F, with the mono `TDEE 2200 kcal · 165P · 220C · 70F` summary below. "Let's go" → single PUT to `/profile` with all 6 fields → `router.replace('/?focus=chat')`.
  - Bootstraps via a `/me` call: bounces to `/login` on 401, bounces to `/` if already onboarded (so users who land here directly post-onboarding don't restart). Picks up the existing `unitSystem` from the profile so step 2 starts on the right unit.
- [`apps/web/components/Dashboard.tsx`](apps/web/components/Dashboard.tsx) — when `/me` resolves and `needsOnboarding(profile) === true`, redirects to `/onboarding` instead of rendering the dashboard. Also reads `?focus=chat` from search params and (on desktop only — `window.innerWidth >= 768`) sets `autoFocus={true}` on `<QuickChatInput>` so post-onboarding users land with the cursor in the chat box.
- [`apps/web/components/QuickChatInput.tsx`](apps/web/components/QuickChatInput.tsx) — accepts an `autoFocus` prop. Holds a ref to the textarea; on mount, if `autoFocus` is true, focuses it.
- [`apps/web/app/settings/page.tsx`](apps/web/app/settings/page.tsx) — simplified imports (now pulls inputs from `components/profile/inputs.tsx`). Lost ~120 lines of duplicate component definitions. No behavioral change.

**Verified.**
- `pnpm typecheck` clean across 4 packages.
- `curl /onboarding` → 200; `curl /settings` → 200 (post-extraction Settings still SSRs).
- Local browser: full fresh-user round-trip — Settings danger-zone delete → re-sign-in → land on `/` → redirected to `/onboarding` → walk all 3 steps → land on `/?focus=chat` → dashboard renders with chat input focused.
- Already-onboarded users visiting `/onboarding` directly bounce to `/`.
- 375px mobile reflow: each step is one-thumb usable, activity radio cards stack cleanly.

**Watch.**
- The `needsOnboarding` helper checks 5 fields and returns false as soon as **any** is filled. If a user partially fills the flow and bails (closes browser between steps), no fields have hit the server yet — they'll re-enter onboarding from step 1 next visit. Acceptable for a 30-second flow; would matter if we ever moved to incremental persistence.
- `autoFocus` on the chat input only fires on the first render after `?focus=chat` arrives. If a user navigates away and back to `/?focus=chat`, the URL persists but the auto-focus only re-fires if `searchParams` changes (it does, since the param is still there). Slight quirk: if you reload the dashboard with `?focus=chat` still in the URL, focus pops again. Probably fine — feels deliberate, not buggy. Could clear the query param after focusing if it gets annoying.
- Onboarding writes `unitSystem` even though the user might not have changed it from the existing default. PUT semantics are PATCH (only sent keys are written), so this is intentional — picks up whichever unit they confirmed in step 2.
- Settings page lost 120 lines but its structure is unchanged. Any new input component added to Settings should land in `components/profile/inputs.tsx` so both flows pick it up.
- The onboarding flow has no `unitSystem`-specific copy ("we'll do the math in pounds" etc.). On step 3, computed values are shown in the canonical units (kcal, g) regardless of the user's display preference. Matches Settings behavior.
- No analytics yet — `signup_completed` and `onboarding_completed` events land in PR 15.
- Step 1 + step 2 keep state in component memory only. There's no Zod validation on the boundary between client steps — the inputs already enforce min/max, and the server's PUT validates everything. No double-validation needed.

### PR 13 — Public landing page at `/` (2026-05-02)

**What landed.** Logged-out visitors at `/` now see a real public landing page instead of being force-redirected to `/login`. Authenticated users still land on the dashboard at the same URL with no extra clicks.

- [`apps/web/app/page.tsx`](apps/web/app/page.tsx) — converted from a client component to a server-component **gate**. Reads the `macros_session` cookie via `next/headers` and renders `<Dashboard />` (existing behavior) or `<Landing />` (new). No middleware, no extra route, no client flash.
- [`apps/web/components/Dashboard.tsx`](apps/web/components/Dashboard.tsx) — extracted from the old `page.tsx`. Same logic, plus a one-line patch in the 401 catch: it now calls `api.logout()` to nuke the stale cookie before redirecting to `/login`. Without this, a stale cookie loops you back through the gate (cookie present → render Dashboard → 401 → /login → revisit / → still has cookie → ...).
- [`apps/web/components/landing/Landing.tsx`](apps/web/components/landing/Landing.tsx) — new server component. Editorial / terminal-ish aesthetic: Geist Mono eyebrows, asymmetric grid, generous negative space, single-color accent (`--color-accent`) used sparingly and loud (hero word, CTA buttons, accent dots). Sections: nav → hero → demo → "How it works" 3 steps → anti-feature callout → final CTA → footer.
- [`apps/web/components/landing/DashboardPreview.tsx`](apps/web/components/landing/DashboardPreview.tsx) — new. Static hard-coded mock that uses the **real** `MacroRing` component (so the preview stays in sync as the dashboard evolves). Wrapped in a CRT-styled frame: thick zinc bezel, faint accent halo behind, scanline overlay (1px lines at 7% opacity), vignette, subtle text glow on the hero remaining-kcal number, animated cursor in the faux chat input. The retro frame is the one place on the page that leans into the brand's playful side; everything else stays editorially sober.
- [`apps/web/app/layout.tsx`](apps/web/app/layout.tsx) — became `async`, reads the same cookie, passes `authenticated` to `BottomNav`. Updated metadata `title` and `description` to the new positioning ("Tracking, in plain language", "the food tracker that listens").
- [`apps/web/components/BottomNav.tsx`](apps/web/components/BottomNav.tsx) — accepts `authenticated` prop; returns null when unauthenticated. Auth-gated chrome shouldn't show on a public page, even on mobile.

Tagline locked: **"Tracking, in plain language."** Positioning swept clean of gym-coded language ("logging" → "typing", "stop tracking" → none). Anti-feature block ("What it doesn't do — no barcode scanner, no 800,000-item database, no friend feed, no streaks, no premium tier, no ads") makes simplicity tangible by naming what's missing.

**Verified.**
- `pnpm typecheck` clean across 4 packages.
- `curl http://localhost:3000/` (no cookie) returns HTTP 200 with the landing markup; `inset-x-0 bottom-0` (BottomNav marker) absent.
- Local browser: landing renders cleanly in light + dark modes; mobile reflows at 375px without horizontal scroll; CRT preview block reads as intentional and not a 90s revival; dashboard post-login renders identically to before extraction.
- Magic-link auth round-trip works locally end-to-end (after fixing an unrelated truncated `STYTCH_PROJECT_ID` in `.env.local` — see lesson).

**Watch.**
- The server gate trusts cookie *presence*, not validity. A stale `macros_session` would render the dashboard shell once before its `/me` 401s and bounces. The Dashboard now clears the cookie on 401 so the next visit is clean. If a future change adds another protected page that bypasses Dashboard's catch logic, that page also needs to clear-then-redirect or you reintroduce the loop.
- `Dashboard.tsx` and `Landing.tsx` are completely independent — extracting Dashboard gave us a clean seam. If you swap the gate to use middleware later (e.g. for edge-side latency), the components don't move.
- The `DashboardPreview` data is hard-coded and will drift from reality over time. That's the trade-off: real components, fake data. If the dashboard's macro math changes meaningfully, update the preview's `totals` and `targets` constants.
- "Magic-link sign in · no password" copy under the CTA is honest now but will need to change when Google OAuth is featured equally.
- No analytics yet — `landing_cta_clicked` and `signup_started` will land in PR 15.
- The hero headline uses a `<br />` for its line break. On very narrow viewports (sub-360px) this looks fine; on very wide viewports the second line still feels balanced. If we ever need it more responsive, swap to `display: block` on the accent span.

### PR 12 — Dev/prod split (2026-05-02)

**What landed.**
- Local `develop` branch created from `main` (post-fast-forward of `a209a1c`); will become the long-running dev target for Vercel.
- `.gitignore` no longer hides `DEPLOY.md`, `tasks/todo.md`, `macrosMVP_phase1.md`. All three are now tracked. (`tasks/todo.md` was already tracked despite the gitignore line — gitignore doesn't affect already-tracked files.)
- [`DEPLOY.md`](DEPLOY.md) rewritten to cover both environments side-by-side: per-env quick reference table, Railway prod + dev (each with its own Postgres), Vercel single-project pattern (Production = `main`, Preview = `develop` aliased to `dev.macros.dalty.io`), DNS for both subdomains, Stytch Test redirect URLs, and a "Migration policy" section codifying auto-on-dev / **manual-on-prod** via Railway service-level start-command override.
- `tasks/todo.md` extended with a Phase 2 section (PR 12 + the pre-launch PR backlog 13–19).
- Committed on `develop` as `1c57e5f`. Not pushed yet (user's call).

**User actions executed (Railway / Vercel / DNS / Stytch):**
- Railway project `accomplished-serenity`: existing env renamed to `dev` (still on `develop` branch via Source change); new `prod` env forked, Postgres add-on added separately, `macros` service pointed at `main`, `CORS_ORIGIN=https://macros.dalty.io`, fresh `SESSION_SECRET`, Custom Start Command set to `pnpm --filter @macros/api start` (no auto-migrate).
- Initial prod migration ran via local `pnpm --filter @macros/db db:migrate` with `DATABASE_URL` overridden to the Postgres `DATABASE_PUBLIC_URL` (the internal `postgres.railway.internal` hostname doesn't resolve from local machines).
- Prod URL `https://macros-prod.up.railway.app/healthz` returns `{"status":"ok","db":"ok"}`.
- DNS: CNAMEs added for `macros` and `dev.macros` → `cname.vercel-dns.com`.
- Vercel: `API_PROXY_TARGET` configured per scope (Preview → dev Railway URL; Production → prod Railway URL), `NEXT_PUBLIC_API_URL=/api` per scope, `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` = Stytch Test token on both scopes (Live deferred). Vercel **Deployment Protection** disabled (project has its own Stytch auth, no need for an extra wall).
- Stytch Test redirect URL allowlist updated to include `https://dev.macros.dalty.io/auth/callback`, `https://macros.dalty.io/auth/callback`, `https://*.vercel.app/auth/callback`.

**Verified.**
- `pnpm typecheck` clean across 4 packages.
- `https://dev.macros.dalty.io/api/healthz` → DB-OK after dev rewire + redeploy.
- `https://dev.macros.dalty.io` loads, fires `/me` `/meals` `/workouts` (401 as expected when logged out), redirects to `/login`. Magic-link round-trip confirmed end-to-end on dev.

**Watch / outstanding for prod side:**
- `macros.dalty.io` domain still needs to be **assigned to Production** in Vercel (Settings → Domains → Add). Once added, smoke-test `https://macros.dalty.io/api/healthz` and run [DEPLOY.md §6](DEPLOY.md#6-end-to-end-smoke-test-run-after-any-infra-change) on prod URL.
- Railway env name is `prod` (not `production` as the original DEPLOY.md drafts referenced); service is named `macros` (not `api`). DEPLOY.md should be tightened to match — defer until prod is fully verified.
- Stytch is still **Test for both envs**. Pre-launch: create Live project, set up Google OAuth client, verify sender domain, swap prod env vars. Until then prod can't deliver magic-link emails to anyone outside the Stytch dashboard owner's allowlist.
- `nixpacks.toml` start command keeps the `db:migrate &&` prefix so dev auto-migrates. Prod's manual policy lives in Railway's Custom Start Command override — if someone clears that field, prod silently falls back to auto-migrate. Worth documenting alongside the Railway service settings.
- `develop` branch hasn't been pushed yet. PR 13 work starts here; first push of `develop` will trigger the dev deploy.

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
