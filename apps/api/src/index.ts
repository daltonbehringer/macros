import { env } from "./env";
import { buildServer } from "./server";

const app = buildServer();

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
