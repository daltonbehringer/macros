import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs from packages/db; load env from the api app where it lives.
config({ path: "../../apps/api/.env.local" });
config({ path: "../../apps/api/.env" });

const url = process.env.DATABASE_URL ?? "postgres://placeholder@localhost/placeholder";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
