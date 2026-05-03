import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { authRoutes } from "./auth/routes";
import { chatRoutes } from "./chat/routes";
import { getDb } from "./db";
import { historyRoutes } from "./history/routes";
import { mealRoutes } from "./meals/routes";
import { profileRoutes } from "./profile/routes";
import { recipeRoutes } from "./recipes/routes";
import { Sentry } from "./sentry";
import { workoutRoutes } from "./workouts/routes";
import { env } from "./env";

export function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    // Trust the Vercel / Railway proxy in front of us so request.ip and
    // protocol come from X-Forwarded-* headers rather than the inner socket.
    trustProxy: env.NODE_ENV === "production",
  });

  app.register(cookie, { secret: env.SESSION_SECRET });
  app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    env: env.NODE_ENV,
    time: new Date().toISOString(),
  }));

  /**
   * Liveness + DB connectivity check. Railway's healthcheck hits this and
   * recycles the container if it fails.
   */
  app.get("/healthz", async (_req, reply) => {
    try {
      const { db } = getDb();
      await db.execute(sql`select 1`);
      return { status: "ok", db: "ok" };
    } catch (err) {
      reply.code(503).send({ status: "degraded", db: "error" });
    }
  });

  app.register(authRoutes);
  app.register(profileRoutes);
  app.register(mealRoutes);
  app.register(workoutRoutes);
  app.register(recipeRoutes);
  app.register(historyRoutes);
  app.register(chatRoutes);

  // Forward unhandled exceptions to Sentry. Sentry's beforeSend handler
  // strips request bodies/cookies/auth headers so chat content doesn't leak
  // — we just need to capture before Fastify replies. Skip 4xx (those are
  // expected user errors, not bugs); only capture 5xx and unclassified.
  app.setErrorHandler(async (err, req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
      // Attach the (anonymous) user id for correlation if the request was
      // authenticated. No email, no profile data.
      Sentry.withScope((scope) => {
        if (req.user?.id) scope.setUser({ id: req.user.id });
        Sentry.captureException(err);
      });
    }
    req.log.error({ err }, "request errored");
    reply.code(status).send({
      error: (err as { code?: string }).code ?? "internal_error",
    });
  });

  return app;
}
