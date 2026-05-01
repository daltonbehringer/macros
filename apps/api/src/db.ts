import { createClient, type DbHandle } from "@macros/db";
import { env } from "./env";

let cached: DbHandle | undefined;

export function getDb(): DbHandle {
  if (!cached) {
    cached = createClient(env.DATABASE_URL, { max: 10 });
  }
  return cached;
}
