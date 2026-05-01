import type { FastifyRequest, FastifyReply } from "fastify";
import { SESSION_COOKIE } from "./cookie";
import { getUserByStytchId, type AppUser } from "./provision";
import { authenticateSession } from "./stytch";

declare module "fastify" {
  interface FastifyRequest {
    user?: AppUser;
  }
}

/** Fastify preHandler: rejects with 401 unless the request carries a valid session. */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) {
    reply.code(401).send({ error: "unauthenticated" });
    return;
  }

  let stytchUserId: string;
  try {
    ({ stytchUserId } = await authenticateSession(token));
  } catch {
    reply.code(401).send({ error: "session_invalid" });
    return;
  }

  const user = await getUserByStytchId(stytchUserId);
  if (!user) {
    // Stytch session is valid but our user row is gone — treat as logged out.
    reply.code(401).send({ error: "user_not_found" });
    return;
  }
  req.user = user;
}
