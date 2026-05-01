import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;
export type TxClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export interface DbHandle {
  db: DbClient;
  sql: Sql;
  close: () => Promise<void>;
}

/**
 * Create a Drizzle client + the underlying postgres-js Sql.
 * The Sql handle is exposed only for migration / shutdown — application code
 * should never use it directly. All user-data queries must go through forUser().
 */
export function createClient(connectionString: string, opts?: { max?: number }): DbHandle {
  const sql = postgres(connectionString, { max: opts?.max ?? 10 });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export { schema };
export * from "./forUser";
