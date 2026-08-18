import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { visualizer } from "rollup-plugin-visualizer";
import { createGenerator, presetWind3, type PresetWind3Theme } from "unocss";
import { walliUnoTheme } from "./uno.theme.ts";

const walliChatUnoCssId = "virtual:walli-chat-uno-styles";
const resolvedWalliChatUnoCssId = `\0${walliChatUnoCssId}`;
const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const demoRoot = fileURLToPath(new URL("./demo", import.meta.url));
const sourceRoot = fileURLToPath(new URL("./src", import.meta.url));
const styleSourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function collectStyleSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectStyleSourceFiles(path)));
    } else if (entry.isFile() && styleSourceExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

export function walliChatUnoCss(): Plugin {
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

      const walliChatStyleSourceFiles = await collectStyleSourceFiles(sourceRoot);

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

export default defineConfig(({ command, mode }) => ({
  root: command === "serve" || mode === "demo" ? demoRoot : projectRoot,
  cacheDir: resolve(projectRoot, "node_modules/.vite/walli-chat-demo"),
  publicDir: mode === "demo" ? resolve(projectRoot, "public") : false,
  plugins: [
    walliChatUnoCss(),
    mode === "analyze" &&
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
      }),
  ],
  server: {
    port: 5174,
  },
  optimizeDeps: {
    entries: [resolve(projectRoot, "demo/index.html")],
  },
  resolve: {
    alias: [
      {
        find: /^walli_chat\/theme\.css$/,
        replacement: resolve(sourceRoot, "theme.css"),
      },
      {
        find: /^walli_chat$/,
        replacement: resolve(sourceRoot, "index.ts"),
      },
    ],
  },
  build:
    mode === "demo"
      ? {
          emptyOutDir: true,
          outDir: resolve(projectRoot, "dist-demo"),
        }
      : {
          cssCodeSplit: false,
          lib: {
            cssFileName: "walli-chat",
            entry: {
              index: resolve(projectRoot, "src/index.ts"),
              react: resolve(projectRoot, "src/react/index.ts"),
              theme: resolve(projectRoot, "src/theme-entry.ts"),
            },
            formats: ["es"],
          },
          rollupOptions: {
            external: ["react"],
            output: {
              assetFileNames: "walli-chat[extname]",
              entryFileNames: "[name].js",
            },
          },
        },
}));
