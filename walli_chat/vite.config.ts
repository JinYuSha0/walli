import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createGenerator, presetWind3 } from "unocss";

const walliChatUnoCssId = "virtual:walli-chat-uno-styles";
const resolvedWalliChatUnoCssId = `\0${walliChatUnoCssId}`;
const walliChatElementFile = fileURLToPath(new URL("./src/components/walli-chat.ts", import.meta.url));

function walliChatUnoCss(): Plugin {
  return {
    name: "walli-chat-uno-css",
    resolveId(id) {
      if (id === walliChatUnoCssId) {
        return resolvedWalliChatUnoCssId;
      }

      return undefined;
    },
    async load(id) {
      if (id !== resolvedWalliChatUnoCssId) {
        return undefined;
      }

      this.addWatchFile(walliChatElementFile);

      const source = await readFile(walliChatElementFile, "utf8");
      const tokens = new Set<string>();

      for (const [, className] of source.matchAll(/class="([^"]+)"/g)) {
        for (const token of className.split(/\s+/)) {
          if (token) {
            tokens.add(token);
          }
        }
      }

      const uno = await createGenerator({
        presets: [presetWind3()],
      });
      const { css } = await uno.generate(tokens, {
        preflights: false,
      });

      return `export default ${JSON.stringify(css)};`;
    },
  };
}

export default defineConfig({
  plugins: [walliChatUnoCss()],
  server: {
    port: 5174,
  },
});
