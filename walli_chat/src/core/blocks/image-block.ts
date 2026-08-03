import type { Token } from "marked";
import { createBlockBase, parseMarkdownHref } from "../helper";
import type { BlockLayout, ParseContext, PreparedImageBlock } from "../type";
import { computed } from "@preact/signals-core";
import { customElement } from "lit/decorators.js";
import { BlockShellElement } from "./block-shell";
import { html, type TemplateResult } from "lit";

const ImageBlockStyle = computed(() => ({
  imageAspectRatio: 16 / 9,
  imageBlockWidthRatio: 0.8,
}));

export function getImageBlockStyle(key: keyof (typeof ImageBlockStyle)["value"]) {
  return ImageBlockStyle.value[key];
}

export function buildImageBlock(
  tokens: readonly Token[] | undefined,
  ctx: ParseContext,
): PreparedImageBlock | null {
  if (!tokens || tokens.length !== 1) return null;

  const token = tokens[0]!;
  if (token.type !== "image") return null;

  const src = parseMarkdownHref(token.href);
  if (!src) return null;

  return {
    ...createBlockBase(ctx),
    alt: token.text.length > 0 ? token.text : "image",
    aspectRatio: resolveImageAspectRatio(src),
    kind: "image",
    src,
  };
}

// fixme
function resolveImageAspectRatio(src: string): number {
  const match = src.match(/\/(\d{2,5})\/(\d{2,5})(?:[/?#]|$)/);
  if (match === null) return getImageBlockStyle("imageAspectRatio");

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return getImageBlockStyle("imageAspectRatio");
  }

  return width / height;
}

type ImageBlockLayout = Extract<BlockLayout, { kind: "image" }>;

@customElement("walli-image-block")
export class WalliImageBlockElement extends BlockShellElement<ImageBlockLayout> {
  protected override renderContent(block: ImageBlockLayout, contentInsetX: number): TemplateResult {
    return html`<img
      class="absolute top-0 block max-w-full rounded-[10px] bg-muted object-contain ring-1 ring-border"
      src=${block.src}
      alt=${block.alt}
      loading="lazy"
      decoding="async"
      width=${Math.round(block.width)}
      height=${Math.round(block.height)}
      style=${`left:${contentInsetX + block.contentLeft}px; width:${block.width}px; height:auto;`}
    />`;
  }
}
