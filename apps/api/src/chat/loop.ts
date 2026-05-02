import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CHAT_EFFORT, CHAT_MAX_TOKENS, CHAT_MODEL } from "./anthropic";
import { executeTool, TOOL_DEFINITIONS, type ToolContext } from "./tools";

const MAX_ITERATIONS = 8;

export type ChatTurnResult = {
  /** The final assistant text reply. */
  text: string;
  /** Every tool call made during this turn, for audit + chat_messages persistence. */
  toolCalls: Array<{ name: string; input: unknown; result: unknown }>;
  /** All assistant content blocks from the final turn (for debugging / future caching). */
  finalContent: Anthropic.ContentBlock[];
  usage: Anthropic.Usage;
};

export async function runChatTurn(args: {
  systemStable: string;
  systemVolatile: string;
  history: Anthropic.MessageParam[];
  userMessage: string;
  ctx: ToolContext;
}): Promise<ChatTurnResult> {
  const { systemStable, systemVolatile, history, userMessage, ctx } = args;

  // System prompt as two blocks: stable prefix is cached, volatile tail isn't.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: systemStable,
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: systemVolatile },
  ];

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  const toolCalls: ChatTurnResult["toolCalls"] = [];
  let totalUsage: Anthropic.Usage | undefined;
  let finalContent: Anthropic.ContentBlock[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: CHAT_EFFORT },
      system,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    totalUsage = mergeUsage(totalUsage, response.usage);
    finalContent = response.content;

    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        text,
        toolCalls,
        finalContent,
        usage: totalUsage ?? response.usage,
      };
    }

    if (response.stop_reason !== "tool_use") {
      throw new Error(`unexpected stop_reason: ${response.stop_reason}`);
    }

    // Append assistant turn (with all tool_use blocks) verbatim — required for
    // the next iteration to reference them by id.
    messages.push({ role: "assistant", content: response.content });

    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const result = await executeTool(block.name, block.input, ctx);
      toolCalls.push({
        name: block.name,
        input: block.input,
        result: result.ok ? result.data : { error: result.error },
      });
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result.ok ? result.data : { error: result.error }),
        is_error: !result.ok,
      });
    }

    messages.push({ role: "user", content: toolResultBlocks });
  }

  throw new Error(
    `chat loop exceeded ${MAX_ITERATIONS} iterations without end_turn`,
  );
}

function mergeUsage(
  prev: Anthropic.Usage | undefined,
  next: Anthropic.Usage,
): Anthropic.Usage {
  if (!prev) return next;
  return {
    ...next,
    input_tokens: (prev.input_tokens ?? 0) + (next.input_tokens ?? 0),
    output_tokens: (prev.output_tokens ?? 0) + (next.output_tokens ?? 0),
    cache_creation_input_tokens:
      (prev.cache_creation_input_tokens ?? 0) +
      (next.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens:
      (prev.cache_read_input_tokens ?? 0) + (next.cache_read_input_tokens ?? 0),
  };
}
