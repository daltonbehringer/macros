# Claude Code Handoff: Nutrition & Calorie Tracking Web App

## Project Overview

Build an LLM-powered nutrition and calorie tracking web app. The differentiator is conversational input: users describe meals, workouts, and questions in natural language, and an LLM parses, stores, and reasons over their nutrition data. Example flow: user says "had a chicken burrito bowl for lunch and ran 5 miles, what can I have for dessert?" → LLM logs the meal macros, logs the workout calorie burn, and recommends a dessert that fits the remaining daily macro budget.

There is an existing repo committed already. Inspect it before scaffolding anything new.

## Tech Stack (Locked)

- **Frontend**: Next.js (TSX/JSX) + Tailwind CSS, hosted on Vercel
- **Backend**: Node.js (TypeScript) on Railway
- **Auth**: Stytch (use Consumer Authentication, not B2B). Credentials live in `apps/api/.env.local` (gitignored): `STYTCH_PROJECT_ID`, `STYTCH_SECRET`, `STYTCH_PUBLIC_TOKEN`.
- **Database**: Postgres on Railway (use Railway's managed Postgres add-on)
- **LLM**: Anthropic Claude API (use `claude-sonnet-4-5` or current latest; verify in Anthropic docs at runtime)
- **Charts**: Recharts (React-native, integrates cleanly with Tailwind)

### On Python in the Backend

For this MVP, **skip Python**. Every backend operation here — Stytch session validation, Postgres CRUD, Claude API calls with tool use, simple aggregations for charts — is more efficient in Node/TypeScript because:
1. Type sharing between frontend and backend (single language, shared types via a `packages/shared` directory or similar)
2. No cross-runtime serialization overhead
3. Railway deploys a single service instead of two
4. Anthropic's TypeScript SDK is first-class

Reserve Python for if/when you add: ML-based meal photo recognition, custom nutrition embeddings, or heavy data science workflows. None of those are in MVP scope. If those land later, add a separate Python service (FastAPI) on Railway and call it from Node.

## Repository Structure

First, run `git status` and `ls -la` in the existing repo. Inspect what's already there before generating new files. Then organize as a monorepo:

```
/apps
  /web          # Next.js frontend → Vercel
  /api          # Node/Express or Fastify backend → Railway
/packages
  /shared       # Shared TS types (User, Meal, Workout, MacroLog, etc.)
  /db           # Drizzle ORM schema + migrations
```

Use **pnpm workspaces** or **Turborepo**. Turborepo is recommended for build caching and task orchestration.

## Database Schema (Postgres + Drizzle ORM)

Use Drizzle ORM over Prisma — lighter weight, better TS inference, faster cold starts on Railway.

Core tables:

- `users` — `id` (UUID, PK), `stytch_user_id` (unique, indexed), `email`, `created_at`, `updated_at`
- `user_profiles` — `user_id` (FK, PK), `height_cm`, `weight_kg`, `age`, `sex`, `activity_level` (enum: sedentary/light/moderate/active/very_active), `daily_calorie_target` (nullable — null means use computed BMR×activity), `daily_protein_g`, `daily_carbs_g`, `daily_fat_g`, `unit_system` (metric/imperial)
- `meals` — `id`, `user_id` (FK, indexed), `consumed_at` (timestamptz), `description` (text — what the user typed), `calories`, `protein_g`, `carbs_g`, `fat_g`, `source` (enum: llm_parsed/manual/recipe), `recipe_id` (nullable FK), `created_at`
- `workouts` — `id`, `user_id` (FK, indexed), `performed_at`, `description`, `calories_burned`, `duration_minutes` (nullable), `created_at`
- `recipes` — `id`, `user_id` (FK, indexed), `name`, `description`, `ingredients` (jsonb), `calories_per_serving`, `protein_g`, `carbs_g`, `fat_g`, `servings`, `created_by` (enum: user/llm), `created_at`, `updated_at`
- `chat_messages` — `id`, `user_id` (FK, indexed), `role` (user/assistant), `content`, `tool_calls` (jsonb, nullable), `created_at` — for conversational context window

### Critical: Data Partitioning & Privacy

**Every query MUST be scoped by `user_id`.** Implement this with:

1. A middleware that extracts the authenticated `user_id` from the Stytch session and attaches it to `req.context.userId`
2. A `db.forUser(userId)` helper that wraps Drizzle queries and *requires* a userId — never expose raw `db` to route handlers
3. Postgres Row-Level Security (RLS) as a defense-in-depth backstop. Enable RLS on every user-scoped table and create a policy `USING (user_id = current_setting('app.current_user_id')::uuid)`. Set the GUC at the start of each request.

This is the most important non-feature requirement — get it wrong and you have a privacy breach. Write integration tests that verify user A cannot read/write user B's data.

## Authentication (Stytch)

Use **Stytch Consumer**, not B2B. Recommended flows for MVP:
- Email Magic Links (primary)
- Optionally Google OAuth

### Dev/Test Setup
- Create two Stytch projects: one **Test** (use test environment keys) and one **Live** (set up but unused until launch)
- Test environment supports test email addresses that auto-resolve magic links without sending real email — use these for E2E tests
- Store `STYTCH_PROJECT_ID` and `STYTCH_SECRET` separately for test/prod, never commit either

### Backend integration
- Use `stytch` Node SDK
- On every protected route: validate session token from cookie via `stytch.sessions.authenticate({ session_token })`
- On first successful auth for a `stytch_user_id` not in `users` table, create the user row + empty profile

## LLM Integration (Anthropic Claude)

Use Claude with **tool use** to handle structured logging. Define tools the model can call:

- `log_meal({ description, calories, protein_g, carbs_g, fat_g, consumed_at? })`
- `log_workout({ description, calories_burned, duration_minutes?, performed_at? })`
- `get_daily_summary({ date? })` — returns remaining macro budget
- `get_recent_meals({ days })` — for context
- `save_recipe({ name, ingredients, calories_per_serving, ... })`
- `get_recipes({ query? })`

Flow:
1. User sends a message in the chat UI
2. Backend retrieves last N messages from `chat_messages` for context
3. Backend calls Claude with system prompt + tool definitions + history + new message
4. If Claude returns `tool_use` blocks, execute them server-side (always scoped to `user_id`), append `tool_result`, send back to Claude
5. Loop until Claude returns plain text response
6. Persist the user message, all tool calls, and final assistant message to `chat_messages`

**System prompt should include**: today's date, the user's daily targets, today's running totals (calories consumed, calories burned, macros), and recent meals. Refresh this on every turn — don't trust the model to remember.

**Don't** let the LLM perform unbounded queries. Tools should accept narrow parameters and the implementation enforces user scoping.

## Calorie Math

Compute **TDEE** (Total Daily Energy Expenditure) from profile:

1. **BMR** via Mifflin-St Jeor:
   - Male: `10*kg + 6.25*cm - 5*age + 5`
   - Female: `10*kg + 6.25*cm - 5*age - 161`
2. **TDEE** = BMR × activity multiplier (1.2 sedentary, 1.375 light, 1.55 moderate, 1.725 active, 1.9 very active)
3. **Net daily calories** = consumed − (TDEE includes passive burn already, so only add *active* workout burn on top: net deficit/surplus = consumed − TDEE − active_workout_calories)

Show this math transparently somewhere (a "How we calculate your targets" link in settings). Allow override of computed targets with manual values.

## Pages / Routes

- `/login` — Stytch magic link form
- `/auth/callback` — Stytch redirect handler
- `/` (dashboard) — today's macro rings, calories remaining, recent activity feed, quick chat input
- `/chat` — full conversational interface (or modal/drawer from dashboard)
- `/history` — date range picker (day/week/month/custom), charts (calorie trend, macro breakdown, deficit/surplus over time)
- `/recipes` — list, create, edit, delete recipes
- `/settings` — profile (height/weight/age/sex/activity), targets (computed + override), units, theme toggle. **Delete all data button at the bottom, red, with a typed-confirmation modal ("type DELETE to confirm").**

## Frontend Design Direction

Use the `frontend-design` skill in `/mnt/skills/user/frontend-design/SKILL.md` — read it before writing any UI code.

Aesthetic brief:
- **Modern dashboard, "techy" but not busy.** Think Linear, Vercel dashboard, Raycast — restrained density, strong typography, purposeful color
- **Light and dark modes**, both first-class. Use CSS variables; toggle via `class="dark"` on `<html>` (Tailwind's `darkMode: 'class'` config)
- **Typography**: pair a distinctive display font with a clean body font. Avoid Inter — too generic. Consider Geist, JetBrains Mono for numerics, or something like Söhne (commercial) / a paid alternative; or use Geist + Geist Mono from Vercel as a strong free pairing that still looks premium
- **Color**: pick one accent (e.g. an electric green, deep amber, or vivid blue) and use it sparingly on key data — calorie ring, primary CTA, active state. Everything else neutral.
- **Numerics matter** — this is a tracking app. Tabular numbers (`font-variant-numeric: tabular-nums`) for all macro/calorie displays. Big, confident hero numbers on the dashboard.
- **Charts**: minimal axes, accent-colored data, no chart-junk. Recharts with custom theming.

### Responsive
- Desktop-first design that gracefully collapses
- Breakpoint: Tailwind's `md` (768px) is the desktop/mobile cutover
- Mobile: bottom nav bar (Dashboard / Chat / History / Settings), single column, chat drawer becomes full screen
- Desktop: left sidebar nav, multi-column dashboard

## Hosting & Dev/Test Environment Setup

### Vercel (frontend)
- Connect the repo, set root directory to `apps/web`
- **Two environments**: Production (main branch) and Preview (every PR auto-deploys to a unique URL — this is your test environment, free)
- Environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` — set differently per environment in Vercel dashboard

### Railway (backend + database)
- Create **two Railway projects** (or two environments within one project): `nutrition-app-dev` and `nutrition-app-prod`
- Each gets its own Postgres add-on — never share a database across environments
- Connect to GitHub: `dev` environment deploys from a `develop` or `staging` branch, `prod` from `main`
- Environment variables per environment: `DATABASE_URL` (auto-injected by Railway Postgres), `STYTCH_PROJECT_ID`, `STYTCH_SECRET`, `ANTHROPIC_API_KEY`, `SESSION_SECRET`, `CORS_ORIGIN`

### Stytch
- Two projects: **Test** and **Live** (Stytch's standard split)
- Dev/preview environments use Test keys; production uses Live keys
- In Stytch dashboard: configure redirect URLs for both Vercel preview wildcard (`https://*.vercel.app/auth/callback`) and your custom prod domain

### Anthropic
- One API key is fine for MVP. Use Anthropic's workspaces feature to create a separate workspace for dev vs prod billing visibility if needed.

### Local development
- `docker-compose.yml` with Postgres for local DB
- `.env.example` checked in, `.env.local` gitignored
- `pnpm dev` runs both apps concurrently (use Turborepo's `dev` task)

## Recommended Skills for Claude Code

You're on Claude Code, which has its own skill system. The most relevant ones already in your environment:

- **`frontend-design`** — read before any UI work. The user explicitly requested this.
- **`skill-creator`** — only if you want to package learnings from this build into a reusable skill afterward.

Beyond what's installed, consider creating project-specific skills as you go:
- A `nutrition-app-conventions` skill capturing this repo's patterns (auth middleware shape, query helpers, RLS setup) so future Claude Code sessions don't re-derive them
- A `claude-tool-use-patterns` skill if the LLM-with-tools loop logic ends up nontrivial — packaging it as a skill makes it easy to extend with new tools later

## Build Order (Suggested)

1. Inspect existing repo. Don't overwrite anything.
2. Set up monorepo structure, shared types package, Drizzle schema + first migration
3. Auth: Stytch integration end-to-end (login → session → protected route returns user)
4. Settings page + profile CRUD + TDEE calculation
5. Manual meal/workout logging (no LLM yet) — proves the data model and RLS work
6. Dashboard with today's macro rings using real data
7. LLM chat with tool use — start with `log_meal` only, expand from there
8. Recipes CRUD + LLM `save_recipe`/`get_recipes` tools
9. History page with date range + charts
10. Delete-all-data flow with typed confirmation
11. Mobile responsive pass
12. Dark mode pass
13. Deploy dev environment end-to-end on Vercel + Railway, then set up prod

## Non-Negotiables (Re-check Before Each PR)

- Every user-data query is scoped by `user_id` at the application layer AND RLS is enabled
- No secrets in the repo. `.env*` files gitignored except `.env.example`
- LLM tool implementations validate inputs and enforce user scoping — never trust tool arguments blindly
- Mobile layout works at 375px width (iPhone SE) without horizontal scroll
- Both light and dark mode tested for every screen
- Delete-all-data actually deletes from every user-scoped table, including `chat_messages`

## Open Questions to Surface Early

Flag these to the user during the build:
- Should chat history be permanent or rolling (e.g. last 30 days)?
- Macro target defaults — split as 30/40/30 protein/carbs/fat? Configurable?
- Workout calorie burn — trust user input fully, or have LLM sanity-check against METs tables?
- Time zones — store everything UTC, render in user's local TZ from browser?
