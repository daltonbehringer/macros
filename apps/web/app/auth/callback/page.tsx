"use client";

import { needsOnboarding } from "@macros/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api";

type Status = "exchanging" | "error";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("exchanging");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    const type = params.get("stytch_token_type");
    if (!token) {
      setStatus("error");
      setErrorCode("missing_token");
      return;
    }
    if (type !== "magic_links" && type !== "oauth") {
      setStatus("error");
      setErrorCode("unsupported_token_type");
      return;
    }
    api
      .authenticate(token, type)
      .then(async () => {
        // Heuristic for "this is a new user": their profile has no identity
        // fields filled in, which is exactly the onboarding trigger. A user
        // who deletes their account and re-signs-in will also fire this; we
        // accept that conflation rather than adding a server-side flag.
        try {
          const me = await api.me();
          if (needsOnboarding(me.profile)) track("signup_completed");
        } catch {
          /* don't block sign-in on a /me hiccup */
        }
        router.replace("/");
      })
      .catch((err) => {
        setStatus("error");
        setErrorCode(err instanceof ApiError ? err.code : "unknown_error");
      });
  }, [params, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="font-mono text-sm uppercase tracking-widest text-zinc-500">
        macros
      </h1>
      {status === "exchanging" ? (
        <p className="text-zinc-600 dark:text-zinc-400">Signing you in…</p>
      ) : (
        <>
          <p className="text-2xl font-semibold tracking-tight">
            Sign-in failed
          </p>
          <p className="text-sm text-zinc-500">
            {errorCode === "missing_token" &&
              "The link is missing its token. Try sending another magic link."}
            {errorCode === "unsupported_token_type" &&
              "This link type isn't supported. Try a fresh magic link."}
            {errorCode === "stytch_authenticate_failed" &&
              "The link is expired or already used. Send a new one."}
            {errorCode === "unknown_error" &&
              "Something went wrong. Try again."}
          </p>
          <a
            href="/login"
            className="text-[color:var(--color-accent)] hover:underline"
          >
            Back to sign in →
          </a>
        </>
      )}
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-6">
          <p className="text-zinc-600 dark:text-zinc-400">Signing you in…</p>
        </main>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
