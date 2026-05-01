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

## Postgres custom GUCs — use `NULLIF(current_setting(name, true), '')`

**Symptom**: RLS policy errors with `invalid input syntax for type uuid: ""` after the first request in a session.

**Root cause**: `set_config(name, value, true)` resets the GUC at end of transaction. The "previous value" of a never-set custom GUC is the empty string, not NULL. So the next transaction's policy expression sees `''::uuid`, which throws.

**Rule**: every RLS policy that casts a custom GUC must wrap with `NULLIF(current_setting('app.foo', true), '')::cast_target`. Never cast directly.

**Reference fix**: [`packages/db/drizzle/0001_rls.sql`](packages/db/drizzle/0001_rls.sql).

**How to apply**: any time a policy references a session/transaction GUC, the cast goes through `NULLIF`. If the policy expression is added later via a new migration, the same rule applies.
