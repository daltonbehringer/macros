"use client";

import type { ChatQuota } from "@macros/shared";
import { useEffect, useRef, useState } from "react";
import { trackChatToolCalls } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api";
import { todayLabel, todayLocal, todayRange } from "@/lib/dates";

const WARN_THRESHOLD = 5;

/**
 * Dashboard chat entry. Sends to /chat, surfaces the reply inline, and
 * notifies the parent so the dashboard can refresh meals/workouts when a tool
 * call logged something. Also surfaces the daily quota counter (PR 17).
 */
export function QuickChatInput({
  onAfterReply,
  autoFocus,
}: {
  onAfterReply?: () => void | Promise<void>;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<ChatQuota | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  // Fetch initial quota on mount so the counter is visible before the user's
  // first send. Silently no-op on failure — quota display is non-essential UX.
  useEffect(() => {
    api
      .getChatQuota()
      .then(setQuota)
      .catch(() => {});
  }, []);

  const exhausted = quota !== null && quota.remaining <= 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || busy || exhausted) return;
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
      setQuota(result.quota);
      setValue("");
      if (result.toolCalls.length > 0) {
        trackChatToolCalls(result.toolCalls);
        await onAfterReply?.();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const data = err.data as { quota?: ChatQuota } | null;
        if (data?.quota) setQuota(data.quota);
        setError(
          "Daily limit reached - resets at midnight local. You can still log meals and workouts manually.",
        );
      } else {
        setError(
          err instanceof ApiError
            ? `chat: ${err.status} ${err.code}`
            : err instanceof Error
              ? err.message
              : "chat failed",
        );
      }
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
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
            }
          }}
          rows={2}
          disabled={busy || exhausted}
          placeholder={
            exhausted
              ? "Daily limit reached — resets at midnight local."
              : 'Tell macros about your day…  e.g. "had a chicken burrito bowl and ran 3 miles"'
          }
          className="block w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm placeholder:text-zinc-400 focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
          <FooterHint busy={busy} quota={quota} />
          <div className="flex items-center gap-3">
            <a
              href="/chat"
              className="font-mono text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              full chat →
            </a>
            <button
              type="submit"
              disabled={!value.trim() || busy || exhausted}
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

function FooterHint({
  busy,
  quota,
}: {
  busy: boolean;
  quota: ChatQuota | null;
}) {
  if (busy) {
    return <span className="font-mono text-zinc-400">Thinking…</span>;
  }
  if (quota && quota.remaining <= 0) {
    return (
      <span className="font-mono text-amber-600 dark:text-amber-400">
        Daily limit reached
      </span>
    );
  }
  const counter = quota ? (
    <span
      className={
        quota.remaining <= WARN_THRESHOLD
          ? "text-amber-600 dark:text-amber-400"
          : "text-zinc-400"
      }
    >
      {quota.remaining}/{quota.limit} today
    </span>
  ) : null;
  return (
    <span className="font-mono text-zinc-400">
      Enter to send · Shift+Enter for newline
      {counter && <span className="ml-2">· {counter}</span>}
    </span>
  );
}
