// CRITICAL: Sentry must initialize before any other module loads so its
// auto-instrumentation can hook into Node's module system. Don't reorder.
import { initSentry } from "./sentry";
initSentry();

import { env } from "./env";
import { buildServer } from "./server";

const app = buildServer();

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
