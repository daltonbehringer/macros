"use client";

import { useState } from "react";

/**
 * Placeholder chat entry. Wires into the real chat loop in PR 7. For now it
 * accepts input but bounces to a "coming soon" message — the manual logging
 * forms below the dashboard remain the working entry path.
 */
export function QuickChatInput() {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setHint(
      "Conversational logging lands in the next PR — for now use the manual forms below.",
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setHint(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
          }
        }}
        rows={2}
        placeholder="Tell macros about your day…  e.g. “had a chicken burrito bowl and ran 3 miles”"
        className="block w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm placeholder:text-zinc-400 focus:outline-none"
      />
      <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
        <span className="text-zinc-400">
          {hint ?? <span className="font-mono">Enter to send · Shift+Enter for newline</span>}
        </span>
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-md bg-[color:var(--color-accent)] px-3 py-1 font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </form>
  );
}
