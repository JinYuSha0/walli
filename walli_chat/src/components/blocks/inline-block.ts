import { customElement } from "lit/decorators.js";
import type { BlockLayout, InlineFragmentLayout } from "../../markdown-chat.model";
import { createBlockShell } from "./block-shell";

type InlineBlockLayout = Extract<BlockLayout, { kind: "inline" }>;

const LINE_ROW_CLASS = "absolute flex w-max items-center gap-0";

@customElement("walli-inline-block")
export class WalliInlineBlockElement extends HTMLElement {
  set layout(layout: { block: InlineBlockLayout; contentInsetX: number }) {
    const { block, contentInsetX } = layout;
    const wrapper = createBlockShell(block, contentInsetX);

    for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
      const line = block.lines[lineIndex]!;
      const row = document.createElement("div");
      row.className = LINE_ROW_CLASS;
      row.style.height = `${block.lineHeight}px`;
      row.style.left = `${contentInsetX + block.contentLeft}px`;
      row.style.top = `${lineIndex * block.lineHeight}px`;

      for (let fragmentIndex = 0; fragmentIndex < line.fragments.length; fragmentIndex++) {
        row.append(renderInlineFragment(line.fragments[fragmentIndex]!));
      }
      wrapper.append(row);
    }

    this.replaceChildren(wrapper);
  }
}

function renderInlineFragment(fragment: InlineFragmentLayout): HTMLElement {
  if (fragment.kind === "image" && fragment.src !== null) {
    const image = document.createElement("img");
    image.className = fragment.className;
    image.src = fragment.src;
    image.alt = fragment.alt ?? "";
    image.loading = "lazy";
    image.decoding = "async";
    if (fragment.leadingGap > 0) {
      image.style.marginLeft = `${fragment.leadingGap}px`;
    }
    return image;
  }

  const node = fragment.href === null ? document.createElement("span") : document.createElement("a");

  node.className = fragment.className;
  if (fragment.leadingGap > 0) {
    node.style.marginLeft = `${fragment.leadingGap}px`;
  }
  node.textContent = fragment.text;

  if (node instanceof HTMLAnchorElement && fragment.href !== null) {
    node.href = fragment.href;
    node.target = "_blank";
    node.rel = "noreferrer";
  }

  return node;
}
