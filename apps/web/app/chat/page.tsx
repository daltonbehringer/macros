"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { todayLabel, todayLocal, todayRange } from "@/lib/dates";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api
      .listChatMessages()
      .then((rows) => {
        setMessages(rows);
        setLoaded(true);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "load failed");
      });
  }, [router]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setValue("");

    // Optimistic user bubble
    const tempUser: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((xs) => [...xs, tempUser]);

    try {
      const range = todayRange();
      const result = await api.sendChat({
        message: text,
        todayLocal: todayLocal(),
        todayLabel: todayLabel(),
        dayStartUtc: range.from,
        dayEndUtc: range.to,
      });
      setMessages((xs) => [
        ...xs,
        {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: result.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `chat: ${err.status} ${err.code}`
          : err instanceof Error
            ? err.message
            : "chat failed",
      );
      // Roll back the optimistic bubble on error
      setMessages((xs) => xs.filter((m) => m.id !== tempUser.id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← macros
        </a>
        <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          chat
        </span>
        <span className="w-12" />
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {!loaded && <p className="text-sm text-zinc-500">Loading…</p>}
          {loaded && messages.length === 0 && (
            <div className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Tell me what you ate or what you did. I&rsquo;ll log it and tell
              you how the day looks.
            </div>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} />
          ))}
          {busy && (
            <div className="self-start text-xs text-zinc-400">Thinking…</div>
          )}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </div>

      <form
        onSubmit={onSend}
        className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
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
            placeholder="Message macros…"
            className="block w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-[color:var(--color-accent)] focus:outline-none disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!value.trim() || busy}
            className="self-stretch rounded-lg bg-[color:var(--color-accent)] px-4 text-sm font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
}

function Bubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div
      className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2 text-sm ${
        isUser
          ? "self-end bg-[color:var(--color-accent)] text-zinc-900"
          : "self-start border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {content}
    </div>
  );
}
