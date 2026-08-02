import { html, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { BlockLayout } from "../../markdown-chat.model";
import { BlockShellElement } from "./block-shell";

type ImageBlockLayout = Extract<BlockLayout, { kind: "image" }>;

@customElement("walli-image-block")
export class WalliImageBlockElement extends BlockShellElement<ImageBlockLayout> {
  protected override renderContent(
    block: ImageBlockLayout,
    contentInsetX: number,
  ): TemplateResult {
    return html`<img
      class="absolute top-0 block max-w-full rounded-[10px] bg-muted object-contain ring-1 ring-border"
      src=${block.src}
      alt=${block.alt}
      loading="lazy"
      decoding="async"
      width=${Math.round(block.width)}
      height=${Math.round(block.height)}
      style=${`left:${contentInsetX + block.contentLeft}px;width:${block.width}px;height:auto;`}
    />`;
  }
}
