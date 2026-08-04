import type { Token } from "marked";
import { createBlockBase, parseMarkdownHref } from "../helper";
import type { BlockLayout, ParseContext, PreparedImageBlock } from "../type";
import { computed } from "@preact/signals-core";
import { customElement } from "lit/decorators.js";
import { BlockShellElement } from "./block-shell";
import { html, type TemplateResult } from "lit";

const ImageBlockStyle = computed(() => ({
  imageBlockHeight: 240,
}));

const WIDTH_ATTRIBUTE_RE = /\bwidth=["']?(\d+(?:\.\d+)?)(?:px)?["']?/;
const HEIGHT_ATTRIBUTE_RE = /\bheight=["']?(\d+(?:\.\d+)?)(?:px)?["']?/;

export function getImageBlockStyle(key: keyof (typeof ImageBlockStyle)["value"]) {
  return ImageBlockStyle.value[key];
}

export function buildImageBlock(
  tokens: readonly Token[] | undefined,
  ctx: ParseContext,
): PreparedImageBlock | null {
  if (!tokens || (tokens.length !== 1 && tokens.length !== 2)) return null;

  const token = tokens[0]!;
  if (token.type !== "image") return null;
  const dimensions = parseImageDimensions(tokens[1]);
  if (tokens.length === 2 && dimensions === null) return null;

  const src = parseMarkdownHref(token.href);
  if (!src) return null;

  return createImageBlock({
    alt: token.text.length > 0 ? token.text : "image",
    ctx,
    dimensions,
    src,
  });
}

type ImageDimensions = {
  height?: number;
  width?: number;
};

function createImageBlock({
  alt,
  ctx,
  dimensions,
  src,
}: {
  alt: string;
  ctx: ParseContext;
  dimensions: ImageDimensions | null;
  src: string;
}): PreparedImageBlock {
  return {
    ...createBlockBase(ctx),
    alt,
    kind: "image",
    src,
    targetHeight: dimensions?.height ?? null,
    targetWidth: dimensions?.width ?? null,
  };
}

function parseImageDimensions(token: Token | undefined): ImageDimensions | null {
  if (token === undefined) return null;
  if (token.type !== "text") return null;

  const source = token.text.trim();
  if (!source.startsWith("{") || !source.endsWith("}")) return null;

  const attributes = source.slice(1, -1);
  const width = readDimension(attributes, WIDTH_ATTRIBUTE_RE);
  const height = readDimension(attributes, HEIGHT_ATTRIBUTE_RE);

  if (width === undefined && height === undefined) return null;

  return { height, width };
}

function readDimension(source: string, pattern: RegExp): number | undefined {
  const value = Number(pattern.exec(source)?.[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;

  return value;
}

type ImageBlockLayout = Extract<BlockLayout, { kind: "image" }>;

@customElement("walli-image-block")
export class WalliImageBlockElement extends BlockShellElement<ImageBlockLayout> {
  protected override renderContent(block: ImageBlockLayout, contentInsetX: number): TemplateResult {
    return html`<img
      class="absolute top-0 block rounded-[10px] bg-muted object-cover ring-1 ring-border"
      src=${block.src}
      alt=${block.alt}
      loading="lazy"
      decoding="async"
      style=${`left:${contentInsetX + block.contentLeft}px; max-width:${block.width}px; height:${block.height}px; width:auto;`}
    />`;
  }
}
