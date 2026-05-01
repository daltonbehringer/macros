-- Row-level security for user-scoped tables.
--
-- Strategy:
--   * For every user-data table, ENABLE + FORCE row level security so the
--     policy applies even to the table owner (the role that runs migrations
--     would otherwise bypass RLS).
--   * Policy uses a Postgres GUC `app.current_user_id` set per-transaction by
--     the application's forUser() helper. `current_setting(name, true)`
--     returns NULL when unset, and `user_id = NULL` is false, so any query
--     that lacks the GUC sees zero rows — failing closed.
--   * `users` itself is intentionally NOT RLS-gated. The auth flow needs to
--     look up users by stytch_user_id before any user context exists, and
--     application code is the only thing that ever reads it.

-- user_profiles ---------------------------------------------------------------

ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_profiles" FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_isolation" ON "user_profiles"
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- meals -----------------------------------------------------------------------

ALTER TABLE "meals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meals" FORCE ROW LEVEL SECURITY;

CREATE POLICY "meals_isolation" ON "meals"
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- workouts --------------------------------------------------------------------

ALTER TABLE "workouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workouts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "workouts_isolation" ON "workouts"
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- recipes ---------------------------------------------------------------------

ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "recipes_isolation" ON "recipes"
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- chat_messages ---------------------------------------------------------------

ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_isolation" ON "chat_messages"
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
