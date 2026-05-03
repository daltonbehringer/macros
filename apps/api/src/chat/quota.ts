import { schema, type TxClient } from "@macros/db";
import type { ChatQuota } from "@macros/shared";
import { and, eq, gte, sql } from "drizzle-orm";

/** Per-user, per-local-day cap. Server is the sole source of truth for this
 * value — clients receive `limit` from API responses and never hard-code. */
export const DAILY_LIMIT = 30;

/**
 * Compute the user's current quota window based on their profile timezone:
 * counts user-role chat_messages since the start of "today" in that tz,
 * returns remaining + limit + the UTC timestamp when the window flips over.
 *
 * Caller MUST run this inside `forUser(db, userId, …)` so RLS applies.
 *
 * Note: timezone is validated against `Intl.supportedValuesOf("timeZone")`
 * before being inlined via `sql.raw` — this avoids the Drizzle param-dedup
 * issue documented in tasks/lessons.md. We also use `sql.raw` for the literal
 * because the same value appears in two SELECT expressions (window start +
 * window end) and Drizzle would otherwise issue distinct $N parameters.
 */
export async function getQuotaForUser(
  tx: TxClient,
  userId: string,
  timezone: string,
): Promise<ChatQuota> {
  const tz = isValidTimeZone(timezone) ? timezone : "UTC";
  const tzLiteral = sql.raw(`'${tz}'`);

  // Compute the UTC moment that corresponds to "today 00:00 in tz" (window
  // start) and "tomorrow 00:00 in tz" (window end / resetsAt). Both come back
  // as ISO timestamps from Postgres so the client can render the reset time.
  const windowRows = await tx.execute<{ start_utc: string; end_utc: string }>(
    sql`
      SELECT
        ((((now() AT TIME ZONE ${tzLiteral})::date)::timestamp) AT TIME ZONE ${tzLiteral}) AS start_utc,
        ((((now() AT TIME ZONE ${tzLiteral})::date + interval '1 day')::timestamp) AT TIME ZONE ${tzLiteral}) AS end_utc
    `,
  );
  const startUtc = new Date(windowRows[0]!.start_utc);
  const resetsAt = new Date(windowRows[0]!.end_utc).toISOString();

  const countRows = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.userId, userId),
        eq(schema.chatMessages.role, "user"),
        gte(schema.chatMessages.createdAt, startUtc),
      ),
    );
  const used = Number(countRows[0]?.n ?? 0);
  const remaining = Math.max(0, DAILY_LIMIT - used);

  return { remaining, limit: DAILY_LIMIT, resetsAt };
}

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
