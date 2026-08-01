import { customElement } from "lit/decorators.js";
import {
  CODE_BLOCK_PADDING_X,
  CODE_BLOCK_PADDING_Y,
  CODE_LINE_HEIGHT,
  type BlockLayout,
} from "../../markdown-chat.model";
import { createBlockShell } from "./block-shell";

type CodeBlockLayout = Extract<BlockLayout, { kind: "code" }>;

const CODE_BOX_CLASS = "absolute top-0 rounded-[10px] bg-secondary ring-1 ring-border shadow-inner";
const CODE_LINE_CLASS =
  "absolute whitespace-pre font-mono text-[12px] font-medium leading-[18px] text-secondary-foreground";

@customElement("walli-code-block")
export class WalliCodeBlockElement extends HTMLElement {
  set layout(layout: { block: CodeBlockLayout; contentInsetX: number }) {
    const { block, contentInsetX } = layout;
    const wrapper = createBlockShell(block, contentInsetX);
    const codeBox = document.createElement("div");
    codeBox.className = CODE_BOX_CLASS;
    codeBox.style.left = `${contentInsetX + block.contentLeft}px`;
    codeBox.style.width = `${block.width}px`;
    codeBox.style.height = `${block.height}px`;

    for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
      const line = block.lines[lineIndex]!;
      const row = document.createElement("div");
      row.className = CODE_LINE_CLASS;
      row.style.left = `${CODE_BLOCK_PADDING_X}px`;
      row.style.top = `${CODE_BLOCK_PADDING_Y + lineIndex * CODE_LINE_HEIGHT}px`;
      row.textContent = line.text;
      codeBox.append(row);
    }

    wrapper.append(codeBox);
    this.replaceChildren(wrapper);
  }
}
