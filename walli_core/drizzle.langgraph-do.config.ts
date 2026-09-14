import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/worker/lib/langgraph/schema.ts",
  out: "./src/worker/lib/langgraph/migrations",
  dialect: "sqlite",
  driver: "durable-sqlite",
  verbose: true,
  strict: true,
});
