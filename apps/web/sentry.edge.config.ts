import * as Sentry from "@sentry/nextjs";

// Edge runtime Sentry init — middleware, edge route handlers. Currently the
// only edge code is layout.tsx's cookie read, but having this prevents a
// Sentry warning about missing edge config.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
