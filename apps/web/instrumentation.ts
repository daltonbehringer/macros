import * as Sentry from "@sentry/nextjs";

// Next.js convention: register() runs once per server boot. Loads the right
// Sentry config based on which runtime is starting.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward Next.js's request errors to Sentry (App Router error boundary +
// route-handler thrown exceptions).
export const onRequestError = Sentry.captureRequestError;
