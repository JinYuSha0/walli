import { customElement } from "lit/decorators.js";
import type { BlockLayout } from "../../markdown-chat.model";
import { createBlockShell } from "./block-shell";

type ImageBlockLayout = Extract<BlockLayout, { kind: "image" }>;

const IMAGE_BLOCK_CLASS =
  "absolute top-0 block max-w-full rounded-[10px] bg-muted object-contain ring-1 ring-border";

@customElement("walli-image-block")
export class WalliImageBlockElement extends HTMLElement {
  set layout(layout: { block: ImageBlockLayout; contentInsetX: number }) {
    const { block, contentInsetX } = layout;
    const wrapper = createBlockShell(block, contentInsetX);
    const image = document.createElement("img");
    image.className = IMAGE_BLOCK_CLASS;
    image.src = block.src;
    image.alt = block.alt;
    image.loading = "lazy";
    image.decoding = "async";
    image.width = Math.round(block.width);
    image.height = Math.round(block.height);
    image.style.left = `${contentInsetX + block.contentLeft}px`;
    image.style.width = `${block.width}px`;
    image.style.height = "auto";
    wrapper.append(image);
    this.replaceChildren(wrapper);
  }
}
