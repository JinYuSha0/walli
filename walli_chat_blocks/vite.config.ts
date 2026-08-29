import { readdir, readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGenerator, presetWind3, type PresetWind3Theme } from "unocss";
import type { Plugin } from "vite";

const virtualUnoCssId = "virtual:walli-chat-blocks-uno-styles";
const resolvedVirtualUnoCssId = `\0${virtualUnoCssId}`;
const sourceRoot = fileURLToPath(new URL("./src", import.meta.url));
const styleSourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
type SourceTokenCacheEntry = {
  mtimeMs: number;
  size: number;
  tokens: Set<string>;
};

function themeColor(name: string): string {
  return `var(--${name}, var(--walli-${name}))`;
}

const theme: PresetWind3Theme = {
  colors: {
    accent: themeColor("accent"),
    border: themeColor("border"),
    card: themeColor("card"),
    foreground: themeColor("foreground"),
    primary: themeColor("primary"),
  },
};

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

export function walliChatBlocksUnoCss(): Plugin {
  const sourceTokenCache = new Map<string, SourceTokenCacheEntry>();
  let generatorPromise: ReturnType<typeof createGenerator> | undefined;
  let generatedCss = "";
  let generatedTokenSignature = "";

  return {
    name: "walli-chat-blocks-uno-css",
    resolveId(id) {
      return id === virtualUnoCssId ? resolvedVirtualUnoCssId : undefined;
    },
    async load(id) {
      if (id !== resolvedVirtualUnoCssId) return undefined;

      const sourceFiles = await collectStyleSourceFiles(sourceRoot);
      const currentFiles = new Set(sourceFiles);
      const tokens = new Set<string>();

      for (const file of sourceFiles) {
        this.addWatchFile(file);
        const fileStat = await stat(file);
        let cacheEntry = sourceTokenCache.get(file);

        if (
          cacheEntry === undefined ||
          cacheEntry.mtimeMs !== fileStat.mtimeMs ||
          cacheEntry.size !== fileStat.size
        ) {
          const fileTokens = new Set<string>();
          const source = await readFile(file, "utf8");
          for (const [, , className] of source.matchAll(/(["'`])([^"'`]+)\1/g)) {
            for (const token of className.split(/\s+/)) {
              if (token) fileTokens.add(token);
            }
          }
          cacheEntry = {
            mtimeMs: fileStat.mtimeMs,
            size: fileStat.size,
            tokens: fileTokens,
          };
          sourceTokenCache.set(file, cacheEntry);
        }

        cacheEntry.tokens.forEach((token) => tokens.add(token));
      }

      for (const cachedFile of sourceTokenCache.keys()) {
        if (!currentFiles.has(cachedFile)) sourceTokenCache.delete(cachedFile);
      }

      const tokenSignature = [...tokens].sort().join("\n");
      if (tokenSignature !== generatedTokenSignature) {
        generatorPromise ??= createGenerator({ presets: [presetWind3()], theme });
        const uno = await generatorPromise;
        generatedCss = (await uno.generate(tokens, { preflights: false })).css;
        generatedTokenSignature = tokenSignature;
      }

      return `export default ${JSON.stringify(generatedCss)};`;
    },
  };
}

export default {
  plugins: [walliChatBlocksUnoCss()],
  build: {
    cssCodeSplit: false,
    lib: {
      cssFileName: "walli-chat-blocks",
      entry: {
        index: "src/index.ts",
        theme: "src/theme-entry.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "@chenglou/pretext",
        "@tanstack/form-core",
        "@wallilabs/chat",
        "dayjs",
        "dayjs/plugin/customParseFormat.js",
        "lit",
        "lucide",
        "zod",
      ],
      output: {
        assetFileNames: "walli-chat-blocks[extname]",
        entryFileNames: "[name].js",
      },
    },
  },
};
