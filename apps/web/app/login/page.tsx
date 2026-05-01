"use client";

import { useState } from "react";
import { api, ApiError, STYTCH_PUBLIC_TOKEN } from "@/lib/api";

type Status = "idle" | "sending" | "sent" | "error";

const STYTCH_TEST_BASE = "https://test.stytch.com/v1/public/oauth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorCode(null);
    try {
      await api.sendMagicLink(email);
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorCode(err instanceof ApiError ? err.code : "unknown_error");
    }
  };

  const onGoogle = () => {
    if (!STYTCH_PUBLIC_TOKEN) {
      setErrorCode("missing_public_token");
      setStatus("error");
      return;
    }
    const callback = `${window.location.origin}/auth/callback`;
    const url =
      `${STYTCH_TEST_BASE}/google/start` +
      `?public_token=${encodeURIComponent(STYTCH_PUBLIC_TOKEN)}` +
      `&login_redirect_url=${encodeURIComponent(callback)}` +
      `&signup_redirect_url=${encodeURIComponent(callback)}`;
    window.location.href = url;
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-stretch justify-center gap-8 px-6">
      <div>
        <h1 className="font-mono text-sm uppercase tracking-widest text-zinc-500">
          macros
        </h1>
        <p className="mt-3 text-3xl font-semibold tracking-tight">
          Sign in
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          We&rsquo;ll email you a magic link.
        </p>
      </div>

      {status === "sent" ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            We sent a sign-in link to <span className="font-mono">{email}</span>.
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-[color:var(--color-accent)] dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="mt-2 rounded-md bg-[color:var(--color-accent)] px-4 py-2 font-medium text-zinc-900 hover:bg-[color:var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span>or</span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <button
            type="button"
            onClick={onGoogle}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            Continue with Google
          </button>

          {errorCode && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errorMessage(errorCode)}
            </p>
          )}
        </>
      )}
    </main>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "invalid_email":
      return "Please enter a valid email address.";
    case "stytch_send_failed":
      return "We couldn't send the link. Try again in a moment.";
    case "missing_public_token":
      return "Google sign-in isn't configured. Check NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN.";
    default:
      return "Something went wrong. Try again.";
  }
}
