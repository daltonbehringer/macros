import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/**
 * In production, we run the API on Railway and the web on Vercel. To keep
 * cookies and CORS simple, the web rewrites `/api/*` to the Railway origin —
 * the browser sees one origin, no CORS, no cross-domain cookie config.
 *
 * Required env (set in Vercel for Production + Preview):
 *   API_PROXY_TARGET=https://<railway-app>.up.railway.app
 *   NEXT_PUBLIC_API_URL=/api
 *
 * In dev we leave both unset so the api client hits http://localhost:4000
 * directly (cross-origin with credentials, handled via CORS).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@macros/shared"],
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    return [{ source: "/api/:path*", destination: `${target}/:path*` }];
  },
};

// withSentryConfig wraps Next's config to (a) auto-instrument the build and
// (b) upload source maps to Sentry on every prod build (gated on
// SENTRY_AUTH_TOKEN — local builds without it skip the upload step).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    // Delete source maps from the public bundle after upload to Sentry, so
    // they're not served to browsers.
    deleteSourcemapsAfterUpload: true,
  },
  // Don't fail the build if Sentry's network is unreachable.
  silent: !process.env.CI,
  disableLogger: true,
});
