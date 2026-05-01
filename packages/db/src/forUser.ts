import { sql } from "drizzle-orm";
import type { DbClient, TxClient } from "./index";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run a callback with the Postgres GUC `app.current_user_id` set, inside a
 * transaction. Every user-scoped table has RLS policies that filter by that
 * GUC, so this is the **only** way application code is allowed to touch
 * per-user data. The raw `db` from createClient() must never be used directly
 * for user data — RLS will silently return zero rows under FORCE ROW LEVEL
 * SECURITY, which is precisely the failure mode this helper prevents.
 */
export async function forUser<T>(
  db: DbClient,
  userId: string,
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  if (!userId || !UUID_RE.test(userId)) {
    throw new Error(`forUser: invalid userId ${JSON.stringify(userId)}`);
  }
  return db.transaction(async (tx) => {
    // SUPERUSERs and table owners bypass RLS; switch to the non-privileged
    // app_user role for this transaction so RLS actually applies.
    await tx.execute(sql`SET LOCAL ROLE app_user`);
    // set_config(name, value, is_local) — is_local=true scopes to the txn.
    await tx.execute(
      sql`select set_config('app.current_user_id', ${userId}, true)`,
    );
    return fn(tx);
  });
}
