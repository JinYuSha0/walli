import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { walliChatUnoCss } from "../walli_chat/vite.config.ts";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    walliChatUnoCss(),
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
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: /^@wallilabs\/chat\/theme\.css$/,
        replacement: resolve("../walli_chat/src/theme.css"),
      },
      {
        find: /^@wallilabs\/chat\/react$/,
        replacement: resolve("../walli_chat/src/react/index.ts"),
      },
      {
        find: /^@wallilabs\/chat$/,
        replacement: resolve("../walli_chat/src/index.ts"),
      },
      { find: "@shared", replacement: resolve("src/shared") },
      { find: "@worker", replacement: resolve("src/worker") },
      { find: "@", replacement: resolve("src/react-app") },
    ],
  },
});
