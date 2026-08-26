import type { Token } from "marked";
import {
  createBlockBase,
  createBlockFrameBase,
  parseImageDimensions,
  parseMarkdownImageSrc,
  type ImageDimensions,
} from "../helper";
import type {
  BlockFrameBase,
  CoreBlockDefinition,
  ParseContext,
  PreparedBlockBase,
} from "../types";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import { customElement } from "lit/decorators.js";
import { BlockShellElement } from "../block-shell";
import { html, type TemplateResult } from "lit";
import { getMediaStyle } from "../styles";

export type PreparedImageBlock = PreparedBlockBase & {
  alt: string;
  kind: "image";
  src: string;
  targetHeight: number | null;
  targetWidth: number | null;
};
export type ImageBlockLayout = {
  alt: string;
  contentLeft: number;
  height: number;
  kind: "image";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  src: string;
  top: number;
  width: number;
};
export type ImageBlockFrame = BlockFrameBase & { kind: "image"; width: number };

export const imageBlockDefinition = {
  name: "image",
  prepare: buildImageBlock,
  measure(block, { availableWidth, top }) {
    const preferredWidth = block.targetWidth ?? availableWidth;
    const width = Math.max(1, Math.round(Math.min(availableWidth, preferredWidth)));
    const height =
      block.targetHeight !== null && block.targetWidth !== null
        ? block.targetHeight * (width / block.targetWidth)
        : (block.targetHeight ?? getMediaStyle("imageHeight"));
    return {
      ...createBlockFrameBase(block, top),
      height: Math.max(1, Math.round(height)),
      kind: "image",
      width,
    };
  },
  materialize(block, frame) {
    return {
      alt: block.alt,
      contentLeft: frame.contentLeft,
      height: frame.height,
      kind: "image",
      markerClassName: frame.markerClassName,
      markerLeft: frame.markerLeft,
      markerText: frame.markerText,
      quoteRailLefts: frame.quoteRailLefts,
      src: block.src,
      top: frame.top,
      width: frame.width,
    };
  },
  render: ({ block, contentInsetX }) =>
    html`<walli-image-block .layout=${{ block, contentInsetX }}></walli-image-block>`,
} satisfies CoreBlockDefinition<"image", typeof buildImageBlock>;

function buildImageBlock(
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

type ImagePreviewSize = {
  height: number;
  width: number;
};

const imagePreviewSizeCache = new Map<string, Promise<ImagePreviewSize | null>>();

@customElement("walli-image-block")
class WalliImageBlockElement extends BlockShellElement<ImageBlockLayout> {
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

void WalliImageBlockElement;
