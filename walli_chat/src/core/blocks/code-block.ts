import { prepareWithSegments } from "@chenglou/pretext";
import { createBlockBase } from "../helper";
import type { BlockLayout, ParseContext, PreparedCodeBlock } from "../type";
import { inlinePiece } from "../styles";
import { getLineHeight, getSpace } from "../styles/config";
import { customElement } from "lit/decorators.js";
import { BlockShellElement } from "./block-shell";
import { html, type TemplateResult } from "lit";
import { computed } from "@preact/signals-core";

const CodeBlockStyle = computed(() => ({
  paddingX: getSpace(3),
  paddingY: getSpace(2),
  lineHeight: getLineHeight("text-sm"),
}));

export function getCodeBlockStyle(key: keyof (typeof CodeBlockStyle)["value"]) {
  return CodeBlockStyle.value[key];
}

export function buildCodeBlock(text: string, ctx: ParseContext): PreparedCodeBlock {
  const { font } = inlinePiece.code(text);
  return {
    ...createBlockBase(ctx),
    kind: "code",
    lineHeight: getCodeBlockStyle("lineHeight"),
    prepared: prepareWithSegments(stripSingleTrailingNewline(text), font, {
      whiteSpace: "pre-wrap",
    }),
  };
}

function stripSingleTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

type CodeBlockLayout = Extract<BlockLayout, { kind: "code" }>;

@customElement("walli-code-block")
export class WalliCodeBlockElement extends BlockShellElement<CodeBlockLayout> {
  protected override markerTop(): number {
    return getCodeBlockStyle("paddingY");
  }

  protected override renderContent(block: CodeBlockLayout, contentInsetX: number): TemplateResult {
    return html`<div
      class="absolute top-0 rounded-[10px] bg-secondary ring-1 ring-border shadow-inner"
      style=${`left:${contentInsetX + block.contentLeft}px; width:${block.width}px; height:${block.height}px;`}
    >
      ${block.lines.map(
        (line, lineIndex) =>
          html`<div
            class="absolute whitespace-pre font-mono text-sm font-medium leading-5 text-secondary-foreground"
            style=${`left:${getCodeBlockStyle("paddingX")}px; top:${getCodeBlockStyle("paddingY") + lineIndex * getCodeBlockStyle("lineHeight")}px;`}
            .textContent=${line.text}
          ></div>`,
      )}
    </div>`;
  }
}
