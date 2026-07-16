import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/worker/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  verbose: true,
  strict: true,
});
