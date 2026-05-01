-- Application role for runtime queries.
--
-- Postgres bypasses RLS for SUPERUSERs and for table owners (unless FORCE is
-- set). The connection used by migrations is necessarily privileged. To make
-- RLS effective at runtime, forUser() does `SET LOCAL ROLE app_user` inside
-- its transaction, switching to a non-super, non-owner role for the duration
-- of the query. The role is NOLOGIN: no one connects as `app_user` directly,
-- they SET ROLE to it after authenticating as the connection role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO app_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
