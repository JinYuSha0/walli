import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/worker/durable-objects/user/schema.ts",
  out: "./src/worker/durable-objects/user/migrations",
  dialect: "sqlite",
  driver: "durable-sqlite",
  verbose: true,
  strict: true,
});
