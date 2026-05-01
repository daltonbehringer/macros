import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { authRoutes } from "./auth/routes";
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

  app.register(authRoutes);

  return app;
}
