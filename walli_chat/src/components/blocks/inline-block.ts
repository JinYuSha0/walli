import { html, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { BlockLayout, InlineFragmentLayout } from "../../markdown-chat.model";
import { BlockShellElement } from "./block-shell";

type InlineBlockLayout = Extract<BlockLayout, { kind: "inline" }>;

@customElement("walli-inline-block")
export class WalliInlineBlockElement extends BlockShellElement<InlineBlockLayout> {
  protected override markerTop(block: InlineBlockLayout): number {
    return Math.max(0, Math.round((block.lineHeight - 12) / 2));
  }

  protected override renderContent(
    block: InlineBlockLayout,
    contentInsetX: number,
  ): TemplateResult[] {
    return block.lines.map(
      (line, lineIndex) =>
        html`<div
          class="absolute flex w-max items-center gap-0"
          style=${`height:${block.lineHeight}px;left:${contentInsetX + block.contentLeft}px;top:${lineIndex * block.lineHeight}px;`}
        >
          ${line.fragments.map(renderInlineFragment)}
        </div>`,
    );
  }
}

function renderInlineFragment(fragment: InlineFragmentLayout): TemplateResult {
  const gapStyle = fragment.leadingGap > 0 ? `margin-left:${fragment.leadingGap}px;` : "";

  if (fragment.kind === "image" && fragment.src !== null) {
    return html`<img
      class=${fragment.className}
      src=${fragment.src}
      alt=${fragment.alt ?? ""}
      loading="lazy"
      decoding="async"
      style=${gapStyle}
    />`;
  }

  if (fragment.href !== null) {
    return html`<a
      class=${fragment.className}
      href=${fragment.href}
      target="_blank"
      rel="noreferrer"
      style=${gapStyle}
      .textContent=${fragment.text}
    ></a>`;
  }

  return html`<span
    class=${fragment.className}
    style=${gapStyle}
    .textContent=${fragment.text}
  ></span>`;
}
