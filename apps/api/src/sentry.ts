import * as Sentry from "@sentry/node";

/**
 * Initialize Sentry. MUST be called as the very first thing on process boot
 * — Sentry's auto-instrumentation hooks Node's module system at init time
 * and won't catch modules already loaded. So index.ts imports this file
 * before anything else.
 *
 * No-ops cleanly when SENTRY_DSN is empty (local dev without a Sentry
 * project), so contributors don't need a DSN to run the API.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,

    // Errors only — no performance/tracing for MVP. Adds quota fast.
    tracesSampleRate: 0,

    // Defensive PII scrubbing. Plan: no message content, no emails; user IDs
    // OK. Sentry's defaults aren't strict enough for this app — chat
    // messages live in request bodies and would leak otherwise.
    sendDefaultPii: false,
    beforeSend(event) {
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
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data && typeof breadcrumb.data === "object") {
        const data = breadcrumb.data as Record<string, unknown>;
        if (typeof data.url === "string") {
          data.url = stripSensitiveQuery(data.url);
        }
      }
      return breadcrumb;
    },
  });
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

export { Sentry };
