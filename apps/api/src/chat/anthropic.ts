import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Per platform.claude.com guidance: use `claude-opus-4-7` unless the user
 * explicitly names a different model. `effort: "high"` is a good balance for
 * agentic tool-use loops; bump to `"xhigh"` if quality regresses, drop to
 * `"medium"` if cost matters more.
 */
export const CHAT_MODEL = "claude-sonnet-4-6";
export const CHAT_EFFORT = "medium" as const;
export const CHAT_MAX_TOKENS = 16000;
