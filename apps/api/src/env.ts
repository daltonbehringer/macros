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
  /**
   * Optional cookie Domain attribute. Leave unset behind a same-origin proxy
   * (Vercel rewrite to Railway). Set to e.g. `.macros.dalty.io` only if the
   * web and api end up on different subdomains without a proxy.
   */
  COOKIE_DOMAIN: z.string().optional(),
  /**
   * Comma-separated allowed origins for CORS. Behind a same-origin proxy this
   * doesn't gate anything (the request is server-side). Still required for
   * dev where the web hits the api cross-origin.
   */
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;
