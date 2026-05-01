import type { CookieSerializeOptions } from "@fastify/cookie";
import { env } from "../env";

export const SESSION_COOKIE = "macros_session";

export const sessionCookieOptions: CookieSerializeOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};
