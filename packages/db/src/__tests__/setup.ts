import { config } from "dotenv";
import postgres from "postgres";

config({ path: "../../apps/api/.env.local" });

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  throw new Error("DATABASE_URL not set; cannot run db integration tests");
}

const TEST_DB_NAME = "macros_test";

/** Build a connection string pointing at TEST_DB_NAME. */
export function testDatabaseUrl(): string {
  const url = new URL(baseUrl!);
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

/** Build a connection string pointing at the maintenance DB (`postgres`). */
function maintenanceUrl(): string {
  const url = new URL(baseUrl!);
  url.pathname = "/postgres";
  return url.toString();
}

/**
 * Drop and recreate the test database. Connects to the maintenance DB so the
 * test DB has no other sessions when we drop it.
 */
export async function resetTestDatabase(): Promise<void> {
  const sql = postgres(maintenanceUrl(), { max: 1 });
  try {
    // Force-disconnect any idle sessions on the test DB before dropping it.
    await sql.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()`,
    );
    await sql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    await sql.unsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
