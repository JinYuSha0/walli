import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "durable-object-sql-migration-loader",
      load(id) {
        if (!id.includes("/src/worker/durable-objects/") || !id.endsWith(".sql")) {
          return null;
        }

        return {
          code: `export default ${JSON.stringify(readFileSync(id, "utf8"))};`,
          map: null,
        };
      },
    },
    cloudflare(),
    {
      name: "remove-local-dev-vars-from-worker-dist",
      closeBundle() {
        rmSync(resolve("dist/walli_core/.dev.vars"), { force: true });
      },
    },
  ],
  resolve: {
    alias: {
      "@": resolve("src/react-app"),
      "@shared": resolve("src/shared"),
      "@worker": resolve("src/worker"),
    },
  },
});
