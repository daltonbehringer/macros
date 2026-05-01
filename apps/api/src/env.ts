import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env.local" });
config({ path: ".env" });

const Env = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  STYTCH_PROJECT_ID: z.string().min(1),
  STYTCH_SECRET: z.string().min(1),
  STYTCH_PUBLIC_TOKEN: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().default("localhost"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;
