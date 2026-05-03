# Lessons Learned

_Updated as corrections are made during development._

## fetch wrappers — only set `content-type: application/json` when there's a body

**Symptom**: bodyless `DELETE` (and `GET`/`HEAD`) requests fail with HTTP 400 from Fastify.

**Root cause**: a fetch wrapper that unconditionally sets `content-type: application/json` tells the server to expect a JSON body. Fastify's JSON body parser then rejects an empty body with 400 *before* the route handler runs — so even a perfectly valid `DELETE /resource/:id` 400s.

**Rule**: in any fetch wrapper, gate the `content-type` header on `init.body` being present. The user can still pass an explicit content-type via `init.headers` for unusual cases.

**Reference fix**: [`apps/web/lib/api.ts`](apps/web/lib/api.ts) — see `request()`.

**How to apply**: any time I add a fetch wrapper or copy this pattern into another project, gate the JSON content-type on `hasBody`. Same applies to `Accept` headers and any other body-implying header.

## RLS isolation tests must run as a non-superuser role

**Symptom**: with RLS enabled, `forUser(A)` still sees user B's rows in tests.

**Root cause**: SUPERUSERs and table owners bypass RLS. The default docker-compose Postgres role (`POSTGRES_USER`) is created as superuser, so any connection authenticated as it ignores policies.

**Rule**: at runtime, switch to a non-super role inside the transaction (`SET LOCAL ROLE app_user`) before setting the GUC. Migrations still run as superuser. The `app_user` role must exist (created in a migration), have `NOLOGIN`, and be granted the minimum CRUD privileges.

**Reference fix**: [`packages/db/drizzle/0002_app_role.sql`](packages/db/drizzle/0002_app_role.sql) and [`packages/db/src/forUser.ts`](packages/db/src/forUser.ts).

**How to apply**: any new RLS-bearing project on a connection that has elevated privileges (which is normal for app DB users on Railway/Supabase/Neon) needs this two-role pattern, or a non-super connection role from the start.

## Drizzle: same `${value}` interpolation in two places renders as two distinct params

**Symptom**: a `GROUP BY <expr>` that's textually identical to the `SELECT <expr>` 400s with `column "..." must appear in the GROUP BY clause` (Postgres error 42803).

**Root cause**: when the same JavaScript value is interpolated twice via `sql\`...${value}...\``, Drizzle issues two separate `$N` placeholders. Postgres compares GROUP BY expressions to SELECT expressions by their parsed expression tree — the parameter index is part of that tree, so `$1` and `$2` are not the same expression even when both bind the identical value. The error message points at the column inside the expression because Postgres can't see that the user-grouped expression matches.

**Rule**: when the same value (typically a config string like a timezone) needs to appear in both clauses, validate it server-side and inline it via `sql.raw(\`'${value}'\`)`. This bypasses parameter binding so SELECT and GROUP BY render the identical literal.

**Reference fix**: [`apps/api/src/history/routes.ts`](apps/api/src/history/routes.ts) — `tzLiteral = sql.raw(\`'${tz}'\`)` after Intl-validating `tz`.

**How to apply**: any time the same scalar is used in both the projection and a GROUP BY / WINDOW / ORDER BY expression, validate + `sql.raw` rather than relying on Drizzle to dedupe parameters.

## Railway: `DATABASE_URL` injected into services uses the private hostname

**Symptom**: `railway run --service <api> pnpm db:migrate` from a local machine fails with `getaddrinfo ENOTFOUND postgres.railway.internal`.

**Root cause**: Railway injects `DATABASE_URL` into application services pointing at the private network hostname `postgres.railway.internal`, which only resolves inside Railway's VPC. `railway run` forwards env vars to your local shell but NOT the private DNS, so any local process reading `DATABASE_URL` will fail to connect.

**Rule**: when running DB-touching commands locally against a Railway Postgres (manual migrations against prod, ad-hoc psql, Drizzle Studio against an env), don't rely on the injected `DATABASE_URL`. Read `DATABASE_PUBLIC_URL` from the **Postgres service** (not the app service) — it's the `proxy.rlwy.net:<port>` form that's reachable from anywhere.

**Reference fix**: in [DEPLOY.md §5](../DEPLOY.md#5-migration-policy) under "Manual prod migration":

```sh
DATABASE_URL=$(railway variables --service Postgres --kv | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2-) \
  pnpm --filter @macros/db db:migrate
```

**How to apply**: anywhere that reads `process.env.DATABASE_URL` and runs outside Railway's network (local CLI, GitHub Actions, etc.) needs the public URL. Inside Railway containers, the injected internal URL is correct and faster. Don't try to make the code "smart" about which to pick — it's a deployment concern, not a code concern.

## Vercel: Deployment Protection blocks aliased Preview domains too

**Symptom**: `curl https://dev.macros.dalty.io/api/healthz` returns Vercel's HTML auth wall ("Authentication Required") instead of proxying to the API.

**Root cause**: Vercel's **Deployment Protection** (Settings → Deployment Protection → Vercel Authentication) defaults to "Standard Protection" which gates every Preview deploy — including ones aliased to a custom domain via "Git Branch → ...". The custom hostname doesn't exempt the deploy.

**Rule**: for any project that has its own application-level auth (Stytch, Auth0, Clerk, custom session cookies, etc.) and uses a long-running preview branch as a real dev environment, **disable Vercel Authentication** on that project. The app's own auth is the real gate; Vercel's wall just blocks external API checks (curl, monitoring, OAuth callbacks, magic-link redirects).

**Reference fix**: Vercel project → Settings → Deployment Protection → Vercel Authentication → Disabled. (Or "Only Production Deployments" if you want the wall on PR previews but not on the aliased dev branch — but the project still has Stytch.)

**How to apply**: the moment you alias a non-prod branch to a custom subdomain (`dev.example.com`, `staging.example.com`), check Deployment Protection. Same applies to any Vercel project where you intend to expose Preview deploys to real users or external services.

## pnpm: optional peer deps split a package into incompatible variants

**Symptom**: after adding `@sentry/node` to one app, `pnpm typecheck` fails with TypeScript errors like `Type 'PgColumn<…>' is not assignable to type 'Aliased<string>'` — the error message names two different paths for the same package (e.g. `drizzle-orm@0.36.4_@types+pg@…` and `drizzle-orm@0.36.4_@opentelemetry+api@1.9.1_@types+pg@…`).

**Root cause**: pnpm creates separate symlink trees per peer-dep combination. When a new package introduces an *optional* peer that an existing dep cares about (here: `@opentelemetry/api`, an optional peer of `drizzle-orm`), pnpm splits that dep into two variants — one for consumers that have the peer, one for consumers that don't. TypeScript treats the two variants as different types because their declarations live in different paths.

**Rule**: when adding a new dep that drags in an OpenTelemetry / instrumentation peer (Sentry, Honeycomb, Datadog, etc.), check `pnpm typecheck` immediately. If it splits, add a `peerDependencyRules.allowAny` entry in the root `package.json`'s `pnpm` block:

```json
"pnpm": {
  "peerDependencyRules": {
    "allowAny": ["@opentelemetry/api"]
  }
}
```

Then `pnpm install --force` to re-resolve. The rule tells pnpm to satisfy the optional peer with whatever's already there instead of creating a new variant.

**Reference fix**: [`package.json`](../package.json) — `pnpm.peerDependencyRules.allowAny`.

**How to apply**: any monorepo using pnpm. The same pattern applies whenever a new package introduces a peer that other packages declare as optional. Generic test: after adding the new dep, search `node_modules/.pnpm` for two entries of the same package at the same version with different peer suffixes — that's the signal.

## Postgres custom GUCs — use `NULLIF(current_setting(name, true), '')`

**Symptom**: RLS policy errors with `invalid input syntax for type uuid: ""` after the first request in a session.

**Root cause**: `set_config(name, value, true)` resets the GUC at end of transaction. The "previous value" of a never-set custom GUC is the empty string, not NULL. So the next transaction's policy expression sees `''::uuid`, which throws.

**Rule**: every RLS policy that casts a custom GUC must wrap with `NULLIF(current_setting('app.foo', true), '')::cast_target`. Never cast directly.

**Reference fix**: [`packages/db/drizzle/0001_rls.sql`](packages/db/drizzle/0001_rls.sql).

**How to apply**: any time a policy references a session/transaction GUC, the cast goes through `NULLIF`. If the policy expression is added later via a new migration, the same rule applies.
