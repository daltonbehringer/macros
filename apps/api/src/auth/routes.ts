import { forUser, schema } from "@macros/db";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getDb } from "../db";
import { env } from "../env";
import { SESSION_COOKIE, sessionCookieOptions } from "./cookie";
import { requireAuth } from "./middleware";
import { findOrCreateUser } from "./provision";
import {
  authenticateMagicLink,
  authenticateOAuth,
  revokeSession,
  sendMagicLink,
} from "./stytch";

const SendBody = z.object({ email: z.string().email() });
const AuthenticateBody = z.object({
  token: z.string().min(1),
  type: z.enum(["magic_links", "oauth"]),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/magic-link/send", async (req, reply) => {
    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_email" });
      return;
    }
    const callbackUrl = `${env.CORS_ORIGIN.split(",")[0]}/auth/callback`;
    try {
      await sendMagicLink({ email: parsed.data.email, callbackUrl });
    } catch (err) {
      req.log.warn({ err }, "stytch send magic link failed");
      reply.code(502).send({ error: "stytch_send_failed" });
      return;
    }
    return { ok: true };
  });

  app.post("/auth/authenticate", async (req, reply) => {
    const parsed = AuthenticateBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body" });
      return;
    }
    let auth;
    try {
      auth =
        parsed.data.type === "magic_links"
          ? await authenticateMagicLink(parsed.data.token)
          : await authenticateOAuth(parsed.data.token);
    } catch (err) {
      req.log.warn({ err }, "stytch authenticate failed");
      reply.code(401).send({ error: "stytch_authenticate_failed" });
      return;
    }

    const user = await findOrCreateUser({
      stytchUserId: auth.stytchUserId,
      email: auth.email,
    });

    reply.setCookie(SESSION_COOKIE, auth.sessionToken, sessionCookieOptions);
    return { user: { id: user.id, email: user.email } };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) {
      await revokeSession(token);
    }
    reply.clearCookie(SESSION_COOKIE, sessionCookieOptions);
    return { ok: true };
  });

  app.get(
    "/me",
    { preHandler: requireAuth },
    async (req) => {
      const user = req.user!;
      const { db } = getDb();
      const profile = await forUser(db, user.id, async (tx) => {
        const rows = await tx
          .select()
          .from(schema.userProfiles)
          .where(eq(schema.userProfiles.userId, user.id))
          .limit(1);
        return rows[0] ?? null;
      });
      return {
        user: { id: user.id, email: user.email },
        profile,
      };
    },
  );
};
