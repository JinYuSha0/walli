import { prepareWithSegments } from "@chenglou/pretext";
import { createBlockBase } from "../helper";
import type { BlockLayout, ParseContext, PreparedCodeBlock } from "../type";
import { inlinePiece } from "../styles";
import { getLineHeight, getSpace } from "../styles/config";
import { customElement } from "lit/decorators.js";
import { BlockShellElement, type BlockRenderLayout } from "./block-shell";
import { html, type TemplateResult } from "lit";
import { computed } from "@preact/signals-core";
import Prism from "prismjs";
import "../components/action-button";

const languageLoaders: Record<string, () => Promise<unknown>> = {
  bash: () => import("prismjs/components/prism-bash"),
  c: () => import("prismjs/components/prism-c"),
  cpp: async () => {
    await loadRequiredLanguage("c");
    await import("prismjs/components/prism-cpp");
  },
  csharp: () => import("prismjs/components/prism-csharp"),
  go: () => import("prismjs/components/prism-go"),
  java: () => import("prismjs/components/prism-java"),
  json: () => import("prismjs/components/prism-json"),
  kotlin: () => import("prismjs/components/prism-kotlin"),
  php: async () => {
    await import("prismjs/components/prism-markup-templating");
    await import("prismjs/components/prism-php");
  },
  python: () => import("prismjs/components/prism-python"),
  ruby: () => import("prismjs/components/prism-ruby"),
  rust: () => import("prismjs/components/prism-rust"),
  sql: () => import("prismjs/components/prism-sql"),
  swift: () => import("prismjs/components/prism-swift"),
  typescript: () => import("prismjs/components/prism-typescript"),
  yaml: () => import("prismjs/components/prism-yaml"),
};
const languageLoads = new Map<string, Promise<unknown>>();

async function loadRequiredLanguage(language: string): Promise<void> {
  await loadLanguage(language);
}

function loadLanguage(language: string | null): Promise<unknown> | null {
  if (language === null || Prism.languages[language] !== undefined) return null;
  const loader = languageLoaders[language];
  if (loader === undefined) return null;
  const existing = languageLoads.get(language);
  if (existing !== undefined) return existing;
  const pending = loader();
  languageLoads.set(language, pending);
  return pending;
}

const CodeBlockStyle = computed(() => ({
  actionWidth: getSpace(10),
  paddingTop: getSpace(3),
  paddingRight: getSpace(3),
  paddingBottom: getSpace(3),
  paddingLeft: getSpace(3),
  lineHeight: getLineHeight("text-sm"),
}));

export function getCodeBlockStyle(key: keyof (typeof CodeBlockStyle)["value"]) {
  return CodeBlockStyle.value[key];
}

export function buildCodeBlock(
  text: string,
  ctx: ParseContext,
  language?: string,
): PreparedCodeBlock {
  const { font } = inlinePiece.code(text);
  const normalizedText = stripSingleTrailingNewline(text);
  return {
    ...createBlockBase(ctx),
    kind: "code",
    language: normalizeLanguage(language),
    lineHeight: getCodeBlockStyle("lineHeight"),
    prepared: prepareWithSegments(normalizedText, font, {
      whiteSpace: "pre-wrap",
    }),
    text: normalizedText,
  };
}

function normalizeLanguage(language?: string): string | null {
  const value = language?.trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (!value) return null;
  const aliases: Record<string, string> = {
    html: "markup",
    cxx: "cpp",
    "c++": "cpp",
    cs: "csharp",
    "c#": "csharp",
    js: "javascript",
    kt: "kotlin",
    py: "python",
    rb: "ruby",
    rs: "rust",
    shell: "bash",
    sh: "bash",
    ts: "typescript",
    xml: "markup",
    yml: "yaml",
  };
  return aliases[value] ?? value;
}

type HighlightSpan = { className: string; text: string };

function highlightLine(text: string, language: string | null): HighlightSpan[] {
  const grammar = language === null ? undefined : Prism.languages[language];
  if (grammar === undefined) return [{ className: "", text }];
  return flattenPrismTokens(Prism.tokenize(text, grammar));
}

function flattenPrismTokens(tokens: Array<string | Prism.Token>, inherited = ""): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  for (const token of tokens) {
    if (typeof token === "string") {
      spans.push({ className: inherited, text: token });
      continue;
    }
    const className = `token ${token.type}`;
    const content = Array.isArray(token.content) ? token.content : [token.content];
    spans.push(...flattenPrismTokens(content, className));
  }
  return spans;
}

function stripSingleTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

type CodeBlockLayout = Extract<BlockLayout, { kind: "code" }>;

@customElement("walli-code-block")
export class WalliCodeBlockElement extends BlockShellElement<CodeBlockLayout> {
  override set layout(layout: BlockRenderLayout<CodeBlockLayout>) {
    super.layout = layout;
    const loading = loadLanguage(layout.block.language);
    if (loading !== null) {
      void loading.then(() => {
        if (this.isConnected) super.layout = layout;
      });
    }
  }

  protected override markerTop(): number {
    return getCodeBlockStyle("paddingTop");
  }

  protected override renderContent(block: CodeBlockLayout, contentInsetX: number): TemplateResult {
    return html`<div
      class="absolute top-0 overflow-hidden rounded-2xl bg-secondary ring-1 ring-border shadow-inner"
      style=${`left:${contentInsetX + block.contentLeft}px; width:${block.width}px; height:${block.height}px;`}
    >
      ${block.lines.map(
        (line, lineIndex) =>
          html`<div
            class="absolute whitespace-pre font-mono text-sm font-medium leading-5 text-secondary-foreground"
            style=${`left:${getCodeBlockStyle("paddingLeft")}px; top:${getCodeBlockStyle("paddingTop") + lineIndex * getCodeBlockStyle("lineHeight")}px;`}
          >${highlightLine(line.text, block.language).map(
            (span) => html`<span class=${span.className}>${span.text}</span>`,
          )}</div>`,
      )}
      <div
        class=${`absolute right-0 top-0 bottom-0 flex justify-center border-l border-border bg-secondary ${block.lines.length === 1 ? "items-center" : "items-start pt-2"}`}
        style=${`width:${getCodeBlockStyle("actionWidth")}px;`}
      >
        <walli-action-button
          .action=${{
            kind: "copy",
            label: "Copy code",
            text: block.lines.map((line) => line.text).join("\n"),
          }}
        ></walli-action-button>
      </div>
    </div>`;
  }
}
