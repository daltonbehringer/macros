import type { DbClient } from "./index";

/**
 * User-scoped query helper. PR 2 will:
 *  - set the Postgres GUC `app.current_user_id` for RLS
 *  - return a query builder that errors if userId is missing
 *
 * For now this is a typed placeholder so api code can import the symbol.
 */
export function forUser(_db: DbClient, _userId: string) {
  throw new Error("forUser() not implemented yet — lands in PR 2");
}
