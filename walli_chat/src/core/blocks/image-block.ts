import type { Token } from "marked";
import {
  createBlockBase,
  parseImageDimensions,
  parseMarkdownImageSrc,
  type ImageDimensions,
} from "../helper";
import type { BlockLayout, ParseContext, PreparedImageBlock } from "../type";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import { computed } from "@preact/signals-core";
import { customElement } from "lit/decorators.js";
import { BlockShellElement } from "./block-shell";
import { html, type TemplateResult } from "lit";

const ImageBlockStyle = computed(() => ({
  imageBlockGap: 2,
  imageBlockHeight: 240,
  imageBlockMaxWidth: 320,
}));

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

  const src = parseMarkdownImageSrc(token.href);
  if (!src) return null;

  return createImageBlock({
    alt: token.text.length > 0 ? token.text : "image",
    ctx,
    dimensions,
    src,
  });
}

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

type ImageBlockLayout = Extract<BlockLayout, { kind: "image" }>;
type ImagePreviewSize = {
  height: number;
  width: number;
};

const imagePreviewSizeCache = new Map<string, Promise<ImagePreviewSize | null>>();

@customElement("walli-image-block")
export class WalliImageBlockElement extends BlockShellElement<ImageBlockLayout> {
  private renderedBlock: ImageBlockLayout | null = null;

  protected override renderContent(block: ImageBlockLayout, contentInsetX: number): TemplateResult {
    this.renderedBlock = block;

    return html`<img
      class="pointer-events-auto absolute top-0 block cursor-zoom-in rounded-[10px] bg-muted object-cover ring-1 ring-border"
      src=${block.src}
      alt=${block.alt}
      loading="lazy"
      decoding="async"
      fetchpriority="low"
      role="button"
      tabindex="0"
      style=${`left:${contentInsetX + block.contentLeft}px; max-width:${block.width}px; height:${block.height}px; width:auto; transform:translateZ(0); backface-visibility:hidden;`}
      @click=${this.handlePreviewClick}
      @keydown=${this.handlePreviewKeydown}
    />`;
  }

  private readonly handlePreviewClick = (event: MouseEvent): void => {
    if (this.renderedBlock === null) return;

    void this.previewImage(event, this.renderedBlock);
  };

  private readonly handlePreviewKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (this.renderedBlock === null) return;

    event.preventDefault();
    void this.previewImage(event, this.renderedBlock);
  };

  private async previewImage(event: Event, block: ImageBlockLayout): Promise<void> {
    const previewSize = await resolvePreviewSize(event.currentTarget, block);

    new PhotoSwipe({
      bgClickAction: "close",
      dataSource: [
        {
          alt: block.alt,
          height: previewSize.height,
          src: block.src,
          width: previewSize.width,
        },
      ],
      index: 0,
      imageClickAction: "close",
      maxZoomLevel: 4,
      secondaryZoomLevel: 2,
      tapAction: "close",
      wheelToZoom: true,
    }).init();
  }
}

async function resolvePreviewSize(
  trigger: EventTarget | null,
  block: ImageBlockLayout,
): Promise<ImagePreviewSize> {
  if (
    trigger instanceof HTMLImageElement &&
    trigger.naturalWidth > 0 &&
    trigger.naturalHeight > 0
  ) {
    return {
      height: trigger.naturalHeight,
      width: trigger.naturalWidth,
    };
  }

  return (
    (await loadImagePreviewSize(block.src)) ?? {
      height: block.height,
      width: block.width,
    }
  );
}

function loadImagePreviewSize(src: string): Promise<ImagePreviewSize | null> {
  const cached = imagePreviewSizeCache.get(src);
  if (cached) return cached;

  const pending = new Promise<ImagePreviewSize | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? { height: image.naturalHeight, width: image.naturalWidth }
          : null,
      );
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });

  imagePreviewSizeCache.set(src, pending);
  return pending;
}
