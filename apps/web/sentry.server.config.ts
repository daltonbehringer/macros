import * as Sentry from "@sentry/nextjs";

// Server-side (Node runtime) Sentry init for the Next.js app — covers SSR
// errors, server actions, and route handlers.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers.cookie;
        delete event.request.headers.authorization;
      }
    }
    if (event.user) delete event.user.email;
    return event;
  },
});
