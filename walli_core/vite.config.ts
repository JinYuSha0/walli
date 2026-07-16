import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    {
      name: "remove-local-dev-vars-from-worker-dist",
      closeBundle() {
        rmSync(resolve("dist/walli_core/.dev.vars"), { force: true });
      },
    },
  ],
});
