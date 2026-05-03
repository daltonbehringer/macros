import * as Sentry from "@sentry/nextjs";

// Browser-side Sentry init. No-ops cleanly when DSN is empty (local dev
// without a Sentry project configured), so contributors don't need a DSN.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,

  // Errors only — no performance/tracing for MVP. Adds quota fast.
  tracesSampleRate: 0,

  // Don't auto-capture replays. Session replay isn't on the free tier.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Defensive PII scrubbing. The plan is "no message content, no emails;
  // user IDs are fine." Sentry's defaults aren't strict enough — strip
  // request bodies, cookies, and auth-bearing headers explicitly.
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubEvent(event);
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data && typeof breadcrumb.data === "object") {
      // Stytch magic-link tokens land in URL query strings on /auth/callback.
      // Short-lived + one-use, but no reason to ship them to Sentry.
      const data = breadcrumb.data as Record<string, unknown>;
      if (typeof data.url === "string") {
        data.url = stripSensitiveQuery(data.url);
      }
    }
    return breadcrumb;
  },
});

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
    }
    if (event.request.url) {
      event.request.url = stripSensitiveQuery(event.request.url);
    }
  }
  if (event.user) delete event.user.email;
  return event;
}

function stripSensitiveQuery(url: string): string {
  try {
    const u = new URL(url, "http://placeholder");
    for (const key of ["token", "stytch_token_type"]) {
      if (u.searchParams.has(key)) u.searchParams.set(key, "[redacted]");
    }
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
}
