import { html, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import {
  CODE_BLOCK_PADDING_X,
  CODE_BLOCK_PADDING_Y,
  CODE_LINE_HEIGHT,
} from "../../core/layout-config";
import type { BlockLayout } from "../../markdown-chat.model";
import { BlockShellElement } from "./block-shell";

type CodeBlockLayout = Extract<BlockLayout, { kind: "code" }>;

@customElement("walli-code-block")
export class WalliCodeBlockElement extends BlockShellElement<CodeBlockLayout> {
  protected override markerTop(): number {
    return CODE_BLOCK_PADDING_Y;
  }

  protected override renderContent(
    block: CodeBlockLayout,
    contentInsetX: number,
  ): TemplateResult {
    return html`<div
      class="absolute top-0 rounded-[10px] bg-secondary ring-1 ring-border shadow-inner"
      style=${`left:${contentInsetX + block.contentLeft}px;width:${block.width}px;height:${block.height}px;`}
    >
      ${block.lines.map(
        (line, lineIndex) =>
          html`<div
            class="absolute whitespace-pre font-mono text-[12px] font-medium leading-[18px] text-secondary-foreground"
            style=${`left:${CODE_BLOCK_PADDING_X}px;top:${CODE_BLOCK_PADDING_Y + lineIndex * CODE_LINE_HEIGHT}px;`}
            .textContent=${line.text}
          ></div>`,
      )}
    </div>`;
  }
}
