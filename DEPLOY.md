# Deploy

Two environments: **prod** (real users) and **dev** (you, in a browser, before things hit prod). Same codebase, separate everything else.

```
                                 macros.dalty.io                                    dev.macros.dalty.io
                          (Vercel — production / main)                       (Vercel — develop branch alias)
                                       │                                                  │
                                       │ /api/*  rewritten by Vercel to ↓                 │ /api/*  rewritten by Vercel to ↓
                                       ▼                                                  ▼
                       macros-api-production.up.railway.app                  macros-api-dev.up.railway.app
                          (Railway "production" env)                            (Railway "dev" env)
                                       │                                                  │
                                       └─►  Postgres add-on                               └─►  Postgres add-on
                                          (production env)                                   (dev env)
```

The browser only ever sees `macros.dalty.io` (prod) or `dev.macros.dalty.io` (dev). Vercel proxies `/api/*` to the matching Railway environment, so cookies stay same-origin and the Railway URL is never exposed publicly.

## Per-environment quick reference

| | Prod | Dev |
|---|---|---|
| Web URL | `https://macros.dalty.io` | `https://dev.macros.dalty.io` |
| Vercel git target | `main` branch | `develop` branch |
| Vercel Vercel-env | Production | Preview (aliased) |
| Railway env | `production` | `dev` |
| Railway Postgres | per-env add-on | per-env add-on |
| Stytch project | Test (until launch); Live thereafter | Test |
| Migrations | **Manual** (start-command override) | Auto on every deploy |
| Anthropic key | one prod key | separate dev key (or shared — your call) |

---

## Prereqs (one-time)

- GitHub repo connected to your account
- Vercel account + Vercel CLI (`brew install vercel-cli`)
- Railway account + Railway CLI (`brew install railway`)
- Stytch dashboard with at least the **Test** project (you have this). A **Live** project is optional until launch.
- DNS access for `dalty.io`

---

## 1. Railway — API + Postgres (both environments)

Railway lets one project hold multiple environments, each with its own Postgres add-on and its own service variables. Use that — don't make two projects.

### 1a. Production environment

1. **Create the project (first time only)**

   ```sh
   railway init   # from the repo root; pick "Empty Project", name it "macros"
   ```

   Railway auto-creates a `production` environment.

2. **Add the Postgres plugin** (Railway dashboard → New → Database → PostgreSQL).
   Railway auto-injects `DATABASE_URL` into every service in the `production` env.

3. **Create the API service**, point it at this GitHub repo, branch `main`:
   - Root directory: leave empty (Nixpacks reads `nixpacks.toml` from the repo root).
   - Watch paths: `apps/api/**`, `packages/**`, `nixpacks.toml`, `pnpm-lock.yaml`, `package.json`.

4. **Set service env vars** (Railway dashboard → Variables, **production** env):

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `STYTCH_PROJECT_ID` | from Stytch project (Test or Live) → API Keys |
   | `STYTCH_SECRET` | from Stytch project → API Keys |
   | `ANTHROPIC_API_KEY` | from console.anthropic.com |
   | `SESSION_SECRET` | `openssl rand -base64 32` |
   | `CORS_ORIGIN` | `https://macros.dalty.io` |
   | `COOKIE_DOMAIN` | leave unset — same-origin via Vercel rewrite |

   Don't set `DATABASE_URL` (Postgres plugin injects it). Don't set `PORT` (Railway injects it).

5. **Override the start command** (Railway dashboard → Service → Settings → Deploy → **Custom Start Command**):

   ```
   pnpm --filter @macros/api start
   ```

   This **drops the `db:migrate &&` prefix** that's in `nixpacks.toml`. See [§5 Migration policy](#5-migration-policy) for why prod migrations run manually.

6. **Deploy**. Railway runs the custom start command above (no auto-migrate).

7. **Note the public URL** (Railway → Settings → Networking → Generate Domain). Format: `macros-api-production.up.railway.app`. You'll paste it into Vercel below.

8. **Run the initial migration manually** (one-time, then any time you ship a schema change):

   ```sh
   railway environment production
   railway run --service api pnpm --filter @macros/db db:migrate
   ```

9. **Smoke test**:

   ```sh
   curl https://macros-api-production.up.railway.app/healthz
   ```

   Expect `{"status":"ok","db":"ok"}`. If it returns 503, the DB connection is broken.

10. **Verify the `app_user` Postgres role** (created idempotently by `0002_app_role.sql`):

    ```sh
    railway run --service postgres psql -c "SELECT rolname FROM pg_roles WHERE rolname = 'app_user'"
    ```

### 1b. Dev environment

1. **Create the dev environment** (Railway dashboard → top-left environment switcher → **New Environment** → name it `dev`). Choose "fork from production" so service definitions and env vars are duplicated; you'll override what differs.

2. **Add a separate Postgres plugin** in the `dev` environment. **Never share a database across environments** — a bad query in dev should not be able to touch prod data.

3. **Override env vars in the `dev` environment** (anything that differs from prod):

   | Variable | Dev value |
   |---|---|
   | `NODE_ENV` | `production` (still — runs the production-mode binary, just against dev infra) |
   | `STYTCH_PROJECT_ID` / `STYTCH_SECRET` | from Stytch **Test** project (already what dev uses) |
   | `ANTHROPIC_API_KEY` | a separate key if you want billing visibility, otherwise reuse |
   | `SESSION_SECRET` | a different `openssl rand -base64 32` than prod |
   | `CORS_ORIGIN` | `https://dev.macros.dalty.io` |

   `DATABASE_URL` and `PORT` are injected by Railway.

4. **Leave the start command empty in the `dev` environment** so the nixpacks default fires:

   ```
   pnpm --filter @macros/db db:migrate && pnpm --filter @macros/api start
   ```

   Dev gets auto-migrate; prod doesn't. See [§5](#5-migration-policy).

5. **Point the dev service at the `develop` branch** (Settings → Source → Branch: `develop`). Watch paths stay the same.

6. **Note the dev public URL** (Settings → Networking → Generate Domain). Format: `macros-api-dev.up.railway.app`. Paste it into Vercel's Preview env vars below.

7. **Smoke test**:

   ```sh
   curl https://macros-api-dev.up.railway.app/healthz
   ```

---

## 2. Vercel — Web (both environments)

Vercel ships Production (the `main` branch) and Preview (every other branch + every PR) out of the box. We use a long-running `develop` branch as the dev target and alias its latest deploy to a stable subdomain so dev work has a bookmarkable URL.

### 2a. Production (main branch)

1. **Import the GitHub repo** at vercel.com/new.

2. **Configure the project**:

   | Setting | Value |
   |---|---|
   | Framework Preset | Next.js (auto-detected from `apps/web/vercel.json`) |
   | Root Directory | `apps/web` |
   | Production Branch | `main` |
   | Build Command | (auto from `vercel.json`) |
   | Install Command | (auto from `vercel.json`) |

3. **Set Production env vars** (Vercel project → Settings → Environment Variables → scope: **Production**):

   | Variable | Value |
   |---|---|
   | `API_PROXY_TARGET` | `https://macros-api-production.up.railway.app` (no trailing slash) |
   | `NEXT_PUBLIC_API_URL` | `/api` |
   | `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` | Stytch **Live** public token (`public-token-live-...`) once Live is set up; **Test** token in the meantime |

4. **Smoke test the rewrite**:

   ```sh
   curl https://macros.dalty.io/api/healthz
   ```

   Should return the same JSON as Railway prod's `/healthz`. If not, the rewrite isn't picking up `API_PROXY_TARGET`.

### 2b. Dev (develop branch → dev.macros.dalty.io)

1. **Set Preview env vars** (scope: **Preview** — applies to every non-`main` branch including `develop` and PR previews):

   | Variable | Value |
   |---|---|
   | `API_PROXY_TARGET` | `https://macros-api-dev.up.railway.app` |
   | `NEXT_PUBLIC_API_URL` | `/api` |
   | `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` | Stytch **Test** public token (`public-token-test-...`) |

2. **Push the `develop` branch** to GitHub (already created locally):

   ```sh
   git push -u origin develop
   ```

   Vercel auto-deploys it as a Preview.

3. **Add `dev.macros.dalty.io` as a domain** (Vercel project → Settings → Domains → Add):
   - Domain: `dev.macros.dalty.io`
   - Assigned to: **Git Branch → develop**

   Vercel will then alias the latest `develop` deploy to that hostname. Future pushes to `develop` re-point the alias automatically.

4. **Smoke test**:

   ```sh
   curl https://dev.macros.dalty.io/api/healthz
   ```

---

## 3. DNS — `macros.dalty.io` and `dev.macros.dalty.io`

In your DNS provider for `dalty.io`:

1. Add a **CNAME** record: `macros` → `cname.vercel-dns.com`
2. Add a **CNAME** record: `dev.macros` → `cname.vercel-dns.com`
3. In Vercel → Project → Domains, add `macros.dalty.io` (assigned to Production) and `dev.macros.dalty.io` (assigned to the `develop` branch). Vercel validates the CNAMEs and provisions TLS certs.
4. Wait a couple minutes; Vercel reports "Valid configuration" once propagation completes for each.

---

## 4. Stytch dashboard config

### 4a. Stytch Test project (drives dev + currently also prod)

**Configuration → Redirect URLs** — add to **both** the Login and Sign-up lists:

- `http://localhost:3000/auth/callback` (local dev)
- `https://dev.macros.dalty.io/auth/callback` (Vercel develop alias)
- `https://macros.dalty.io/auth/callback` (prod, while it still uses Test)
- `https://*.vercel.app/auth/callback` (PR previews)

**OAuth → Google** — should already be enabled for Test.

### 4b. Stytch Live project (when you're ready to launch)

Once you create it:

1. **Configuration → Redirect URLs** — add to both Login and Sign-up:
   - `https://macros.dalty.io/auth/callback`

2. **OAuth → Google** — enable for Live. Live OAuth requires a Google Cloud OAuth client ID (Test sidesteps this).

3. **Email** — verify the sender domain so magic-link emails actually deliver. Without this, links only reach the email of whoever owns the Stytch account.

4. **Swap the prod env vars**:
   - On Railway production: replace `STYTCH_PROJECT_ID` / `STYTCH_SECRET` with Live values.
   - On Vercel production: replace `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` with the Live public token.

> **Pre-launch TODO**: until the Live project exists, prod uses the Test project. Test-mode email-sending is gated on the dashboard owner's email and on billing verification. Don't onboard real users while still on Test.

---

## 4c. Vercel Web Analytics

Web Analytics is wired in code (`<Analytics />` mounted in the root layout, custom events fired via `apps/web/lib/analytics.ts`). It needs one dashboard click to start collecting:

1. Vercel project → **Analytics** tab → **Enable Web Analytics**
2. (Optional) Same panel → **Custom Events** to view per-event counts after they start arriving

Local dev is auto-disabled by the SDK (`mode="auto"` no-ops on `localhost`) — no events fire from `pnpm dev`.

### Custom event vocabulary

The full list lives in `apps/web/lib/analytics.ts` as the `EventName` union — adding a new event anywhere else is a typecheck error. Current events:

| Event | Where | Notes |
|---|---|---|
| `signup_completed` | `/auth/callback` after a successful auth round-trip, only when the resulting profile has no identity fields filled in | Heuristic: a fresh user has empty profile fields. Users who delete their account and re-sign-in will also fire this — accepted conflation rather than a server-side flag |
| `onboarding_completed` | `OnboardingFlow.tsx` after the PUT succeeds | Fires before the redirect to `/?focus=chat` |
| `meal_logged_via_chat` | Chat path (both `QuickChatInput` and `/chat`) when the chat turn's `toolCalls` includes `log_meal` or `log_meal_from_recipe` | Fires at most once per chat turn even if multiple meals were logged — saves quota |
| `meal_logged_manual` | `Dashboard.tsx` `MealForm` after `createMeal` succeeds | Manual entry via the dashboard's "+ Log manually" panel |
| `workout_logged` | Chat path (when `toolCalls` includes `log_workout`) and `Dashboard.tsx` `WorkoutForm` | Single event for both sources — if the chat-vs-manual split matters later, add a `source` prop |
| `delete_account` | `Settings.tsx` after `deleteAllData` succeeds, before the redirect to `/login` | |

Page views are recorded automatically — no per-route instrumentation.

### Quota

Hobby tier: 2,500 events/month. Pro: 25k. Each event above + every page view counts as one event. For an MVP this is generous; once traffic ramps, the page-view firehose is the most likely thing to overshoot — keep an eye on the Analytics tab.

### Privacy

Vercel Web Analytics is cookie-free. No PII is sent: events carry only their name (no user IDs, emails, or message content). Page views carry URL + referrer + device class. Nothing else.

---

## 5. Migration policy

| | Trigger | Mechanism |
|---|---|---|
| **Dev** | Every Railway deploy | `nixpacks.toml` start command runs `db:migrate &&` before the API |
| **Prod** | **Manual** — explicit `railway run` | Railway service-level **Custom Start Command** override drops the `db:migrate &&` prefix |

**Why split.** Phase-1 migrations are additive and idempotent. The first time a destructive migration ships (drop column, rewrite data, NOT NULL backfill, etc.) you do not want it to ride a normal deploy on prod. Dev keeps auto-migrate so you can iterate quickly; prod gates it so the schema change is an intentional, observable action.

**To apply a migration to prod**:

```sh
railway environment production
railway run --service api pnpm --filter @macros/db db:migrate
```

Run this **before** the deploy that needs the new schema, not after, so requests that hit the new code already see the new tables. For destructive migrations, do them in a separate maintenance window with the API scaled to zero or behind a maintenance page.

**To apply a migration to dev**: just push to `develop`. The next deploy auto-migrates.

---

## 6. End-to-end smoke test (run after any infra change)

For each of `https://dev.macros.dalty.io` (dev) and `https://macros.dalty.io` (prod):

1. Open the URL in an incognito window.
2. Sign in with email — you should get redirected to `/auth/callback` and then `/`.
3. Type `had a chicken burrito bowl with extra rice for lunch` in the chat input → Send.
4. The activity feed should populate; the calorie ring should fill.
5. Open `/history` — today's column should reflect the meal you just logged.
6. Open `/recipes` — empty (or whatever you saved).
7. Toggle Settings → Theme → Dark, refresh — no flash of light theme.
8. Resize the browser to 375px width — bottom nav appears, content reflows.

If any step fails, check the Railway service logs (`railway logs --service api -e <env>`) and the Vercel function logs (Vercel → project → Deployments → latest → Functions).

---

## Common ops

**Switch Railway CLI between environments:**

```sh
railway environment dev          # subsequent commands target dev
railway environment production
```

**Run a migration manually against prod:**

```sh
railway environment production
railway run --service api pnpm --filter @macros/db db:migrate
```

**Tail prod logs:**

```sh
railway environment production
railway logs --service api
```

**Tail dev logs:**

```sh
railway environment dev
railway logs --service api
```

**Open Drizzle Studio against an env (read-only browsing):**

```sh
railway environment <env>
railway run --service api pnpm --filter @macros/db db:studio
```

**Promote develop → main (dev → prod release):**

```sh
git checkout main
git merge --ff-only develop   # or: open a PR develop → main and merge in GitHub
git push origin main
# Vercel auto-deploys to https://macros.dalty.io
# Railway production redeploys (no auto-migrate; run db:migrate manually if schema changed)
```

**Rotate `SESSION_SECRET`:** changing it invalidates every existing user's session cookie — they'll be forced to re-auth on next request. Plan accordingly. Rotate per-environment (don't share secrets).

**Roll back a Railway deploy:** Railway → Deployments → pick a prior one → "Redeploy". Per environment.

**Roll back a Vercel deploy:** Vercel → Deployments → pick a prior one → "Promote to Production" (or for dev, re-alias `dev.macros.dalty.io` to that deploy).
