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

export default nextConfig;
