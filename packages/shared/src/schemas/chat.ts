import { z } from "zod";

export const ChatRole = z.enum(["user", "assistant"]);
export type ChatRole = z.infer<typeof ChatRole>;

export const ChatMessage = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: ChatRole,
  content: z.string(),
  tool_calls: z.unknown().nullable(),
  created_at: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

/**
 * Daily chat quota snapshot. Returned by `GET /chat/quota` and embedded in
 * `POST /chat` responses. The server is the sole source of truth for `limit`
 * — clients never assume the value, so changing the cap requires no client
 * deploy.
 */
export const ChatQuota = z.object({
  remaining: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  /** ISO UTC timestamp when the user's quota window flips over. */
  resetsAt: z.string().datetime(),
});
export type ChatQuota = z.infer<typeof ChatQuota>;
