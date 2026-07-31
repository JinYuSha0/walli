import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createGenerator, presetWind3, type PresetWind3Theme } from "unocss";
import { walliUnoTheme } from "./uno.theme.ts";

const walliChatUnoCssId = "virtual:walli-chat-uno-styles";
const resolvedWalliChatUnoCssId = `\0${walliChatUnoCssId}`;
const walliChatElementFile = fileURLToPath(new URL("./src/components/walli-chat.ts", import.meta.url));
const walliChatStyleSourceFiles = [
  walliChatElementFile,
  fileURLToPath(new URL("./src/components/walli-message.ts", import.meta.url)),
  fileURLToPath(new URL("./src/markdown-chat.model.ts", import.meta.url)),
];

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

      for (const file of walliChatStyleSourceFiles) {
        this.addWatchFile(file);
      }

      const tokens = new Set<string>();

      for (const file of walliChatStyleSourceFiles) {
        const source = await readFile(file, "utf8");
        for (const [, , className] of source.matchAll(/(["'`])([^"'`]+)\1/g)) {
          for (const token of className.split(/\s+/)) {
            if (token) {
              tokens.add(token);
            }
          }
        }
      }

      const uno = await createGenerator<PresetWind3Theme>({
        presets: [presetWind3()],
        theme: walliUnoTheme,
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
