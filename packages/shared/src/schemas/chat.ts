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
