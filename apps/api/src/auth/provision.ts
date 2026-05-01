import { forUser, schema } from "@macros/db";
import { eq } from "drizzle-orm";
import { getDb } from "../db";

const { users, userProfiles } = schema;

export type AppUser = {
  id: string;
  email: string;
  stytchUserId: string;
};

/**
 * Look up our `users` row for this Stytch user, creating one (plus an empty
 * profile) on first sight. This is the only place `users` rows are written.
 *
 * `users` itself is not under RLS — see migration 0001_rls.sql. The empty
 * profile insert goes through forUser() so RLS WITH CHECK accepts it.
 */
export async function findOrCreateUser(args: {
  stytchUserId: string;
  email: string;
}): Promise<AppUser> {
  const { db } = getDb();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.stytchUserId, args.stytchUserId))
    .limit(1);
  const found = existing[0];
  if (found) {
    return {
      id: found.id,
      email: found.email,
      stytchUserId: found.stytchUserId,
    };
  }

  const inserted = await db
    .insert(users)
    .values({ stytchUserId: args.stytchUserId, email: args.email })
    .returning();
  const created = inserted[0];
  if (!created) {
    throw new Error("Failed to provision user");
  }

  await forUser(db, created.id, async (tx) => {
    await tx.insert(userProfiles).values({ userId: created.id });
  });

  return {
    id: created.id,
    email: created.email,
    stytchUserId: created.stytchUserId,
  };
}

export async function getUserByStytchId(
  stytchUserId: string,
): Promise<AppUser | null> {
  const { db } = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.stytchUserId, stytchUserId))
    .limit(1);
  const found = rows[0];
  if (!found) return null;
  return {
    id: found.id,
    email: found.email,
    stytchUserId: found.stytchUserId,
  };
}
