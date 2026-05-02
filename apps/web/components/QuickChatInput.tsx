"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { todayLabel, todayLocal, todayRange } from "@/lib/dates";

/**
 * Dashboard chat entry. Sends to /chat, surfaces the reply inline, and
 * notifies the parent so the dashboard can refresh meals/workouts when a tool
 * call logged something.
 */
export function QuickChatInput({
  onAfterReply,
}: {
  onAfterReply?: () => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || busy) return;
    const message = value.trim();
    setBusy(true);
    setReply(null);
    setError(null);
    try {
      const range = todayRange();
      const result = await api.sendChat({
        message,
        todayLocal: todayLocal(),
        todayLabel: todayLabel(),
        dayStartUtc: range.from,
        dayEndUtc: range.to,
      });
      setReply(result.reply);
      setValue("");
      if (result.toolCalls.length > 0) await onAfterReply?.();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `chat: ${err.status} ${err.code}`
          : err instanceof Error
            ? err.message
            : "chat failed",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
            }
          }}
          rows={2}
          disabled={busy}
          placeholder='Tell macros about your day…  e.g. "had a chicken burrito bowl and ran 3 miles"'
          className="block w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm placeholder:text-zinc-400 focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
          <span className="font-mono text-zinc-400">
            {busy
              ? "Thinking…"
              : "Enter to send · Shift+Enter for newline"}
          </span>
          <div className="flex items-center gap-3">
            <a
              href="/chat"
              className="font-mono text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              full chat →
            </a>
            <button
              type="submit"
              disabled={!value.trim() || busy}
              className="rounded-md bg-[color:var(--color-accent)] px-3 py-1 font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </form>

      {reply && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900">
          {reply}
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
