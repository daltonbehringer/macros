import { forUser, schema } from "@macros/db";
import { UpdateUserProfile } from "@macros/shared";
import { eq, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { SESSION_COOKIE, sessionCookieOptions } from "../auth/cookie";
import { requireAuth } from "../auth/middleware";
import { revokeSession } from "../auth/stytch";
import { getDb } from "../db";

const DeleteBody = z.object({ confirmation: z.literal("DELETE") });

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/profile",
    { preHandler: requireAuth },
    async (req) => {
      const user = req.user!;
      const { db } = getDb();
      return forUser(db, user.id, async (tx) => {
        const rows = await tx
          .select()
          .from(schema.userProfiles)
          .where(eq(schema.userProfiles.userId, user.id))
          .limit(1);
        if (!rows[0]) {
          throw new Error("profile missing — provisioning bug");
        }
        return rows[0];
      });
    },
  );

  app.put(
    "/profile",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = UpdateUserProfile.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
        return;
      }
      const user = req.user!;
      const { db } = getDb();

      // Drop undefined keys so we don't overwrite columns the client didn't send.
      const patch = Object.fromEntries(
        Object.entries(parsed.data).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(patch).length === 0) {
        reply.code(400).send({ error: "empty_patch" });
        return;
      }

      return forUser(db, user.id, async (tx) => {
        const updated = await tx
          .update(schema.userProfiles)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(schema.userProfiles.userId, user.id))
          .returning();
        return updated[0];
      });
    },
  );

  app.delete(
    "/me/data",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = DeleteBody.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "invalid_confirmation" });
        return;
      }
      const user = req.user!;
      const { db } = getDb();

      // Wipe through forUser so RLS policies apply on the per-table deletes.
      // user_profiles, meals, workouts, recipes, chat_messages all cascade
      // from users; we delete the user row last as a privileged operation.
      await forUser(db, user.id, async (tx) => {
        await tx.delete(schema.chatMessages);
        await tx.delete(schema.meals);
        await tx.delete(schema.workouts);
        await tx.delete(schema.recipes);
        await tx.delete(schema.userProfiles);
      });

      // users itself is not RLS-gated; delete with an explicit predicate.
      await db.delete(schema.users).where(sql`id = ${user.id}`);

      // Best-effort revoke of the Stytch session attached to this request.
      const cookie = req.cookies[SESSION_COOKIE];
      if (cookie) await revokeSession(cookie);
      reply.clearCookie(SESSION_COOKIE, sessionCookieOptions);
      return { ok: true };
    },
  );
};
