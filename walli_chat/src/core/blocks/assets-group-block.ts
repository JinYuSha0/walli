import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import { html, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { createElement } from "lucide";
import { createBlockFrameBase } from "../helper";
import type { BlockFrameBase, CoreBlockDefinition, PreparedBlockBase } from "../types";
import { getFileIcon } from "../file-icon";
import { BlockShellElement } from "../block-shell";
import type { PreparedImageBlock } from "./image-block";
import { getMediaStyle } from "../styles";

type PreparedFileAsset = { name: string; src: string; type: "file" };
export type PreparedAssetsGroupBlock = PreparedBlockBase & {
  assets: Array<PreparedFileAsset | PreparedImageBlock>;
  kind: "assetsGroup";
};
type AssetsGroupItemLayout = {
  alt: string;
  crop: boolean;
  height: number;
  type: "file" | "image";
  left: number;
  name: string;
  src: string;
  top: number;
  width: number;
};
export type AssetsGroupBlockLayout = {
  contentLeft: number;
  height: number;
  items: AssetsGroupItemLayout[];
  kind: "assetsGroup";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  width: number;
};
type AssetsGroupItemFrame = {
  crop: boolean;
  height: number;
  type: "file" | "image";
  left: number;
  top: number;
  width: number;
};
export type AssetsGroupBlockFrame = BlockFrameBase & {
  items: AssetsGroupItemFrame[];
  kind: "assetsGroup";
  width: number;
};

function layoutAssetsGroup(
  assets: readonly PreparedAssetsGroupBlock["assets"][number][],
  contentWidth: number,
): AssetsGroupBlockFrame["items"] {
  const maxWidth = getMediaStyle("imageMaxWidth");
  if (assets.length === 1 && "kind" in assets[0]!) {
    const image = assets[0]!;
    const availableWidth = Math.max(1, contentWidth - image.contentLeft);
    const width = Math.max(1, Math.round(Math.min(maxWidth, availableWidth)));
    const height =
      image.targetWidth !== null && image.targetHeight !== null
        ? image.targetHeight * (width / image.targetWidth)
        : width * (getMediaStyle("imageHeight") / maxWidth);
    return [
      {
        crop: true,
        height: Math.max(1, Math.round(height)),
        type: "image",
        left: 0,
        top: 0,
        width,
      },
    ];
  }

  const gap = getMediaStyle("imageGap");
  const width = Math.min(contentWidth, maxWidth);
  const columnCount = 3;
  const cell = (width - gap * (columnCount - 1)) / columnCount;

  return assets.map((asset, index) => {
    const row = Math.floor(index / columnCount);
    const columnFromRight = index % columnCount;
    const column = columnCount - columnFromRight - 1;
    return {
      crop: true,
      height: Math.max(1, Math.round(cell)),
      type: "kind" in asset ? "image" : "file",
      left: Math.round(column * (cell + gap)),
      top: Math.round(row * (cell + gap)),
      width: Math.max(1, Math.round(cell)),
    };
  });
}

export const assetsGroupBlockDefinition = {
  name: "assetsGroup",
  prepare: prepareAssetsGroupBlock,
  measure(block, { contentWidth, top }) {
    const items = layoutAssetsGroup(block.assets, contentWidth);
    return {
      ...createBlockFrameBase(block, top),
      height: Math.max(...items.map((item) => item.top + item.height)),
      items,
      kind: "assetsGroup",
      width: Math.max(...items.map((item) => item.left + item.width)),
    };
  },
  materialize(block, frame) {
    return {
      contentLeft: frame.contentLeft,
      height: frame.height,
      items: frame.items.map((itemFrame, index) => ({
        ...itemFrame,
        alt: "kind" in block.assets[index]! ? block.assets[index]!.alt : "",
        name: "type" in block.assets[index]! ? block.assets[index]!.name : block.assets[index]!.alt,
        src: block.assets[index]!.src,
      })),
      kind: "assetsGroup",
      markerClassName: frame.markerClassName,
      markerLeft: frame.markerLeft,
      markerText: frame.markerText,
      quoteRailLefts: frame.quoteRailLefts,
      top: frame.top,
      width: frame.width,
    };
  },
  render: ({ block, contentInsetX }) =>
    html`<walli-assets-group-block .layout=${{ block, contentInsetX }}></walli-assets-group-block>`,
} satisfies CoreBlockDefinition<"assetsGroup", typeof prepareAssetsGroupBlock>;

function prepareAssetsGroupBlock(
  assets: PreparedAssetsGroupBlock["assets"],
  base: PreparedBlockBase,
): PreparedAssetsGroupBlock {
  return {
    ...base,
    assets,
    kind: "assetsGroup",
  };
}

@customElement("walli-assets-group-block")
class WalliAssetsGroupBlockElement extends BlockShellElement<AssetsGroupBlockLayout> {
  private renderedBlock: AssetsGroupBlockLayout | null = null;

  protected override renderContent(
    block: AssetsGroupBlockLayout,
    _contentInsetX: number,
  ): TemplateResult {
    this.renderedBlock = block;
    return html`<div
      class="pointer-events-auto absolute right-0 top-0 touch-manipulation"
      style=${`width:${block.width}px;height:${block.height}px;`}
    >
      ${block.items.map((item, index) =>
        item.type === "image"
          ? html`<img
              class="pointer-events-auto absolute block cursor-zoom-in touch-manipulation select-none rounded-[10px] bg-muted object-cover ring-1 ring-border"
              src=${item.src}
              alt=${item.alt}
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              role="button"
              tabindex="0"
              draggable="false"
              data-index=${index}
              style=${`left:${item.left}px;top:${item.top}px;width:${item.width}px;height:${item.height}px;object-fit:${item.crop ? "cover" : "contain"};transform:translateZ(0);backface-visibility:hidden;`}
              @click=${this.handlePreviewClick}
              @keydown=${this.handlePreviewKeydown}
            />`
          : html`<a
              class="pointer-events-auto absolute box-border grid grid-rows-[1fr_24px] rounded-[10px] bg-muted p-2 text-foreground no-underline ring-1 ring-border"
              href=${item.src}
              target="_blank"
              rel="noopener noreferrer"
              title=${item.name}
              style=${`left:${item.left}px;top:${item.top}px;width:${item.width}px;height:${item.height}px;`}
            >
              <span class="flex w-full -translate-y-2 items-center justify-center">
                <span
                  class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-background"
                >
                  ${createElement(getFileIcon({ name: item.name, type: "" }), {
                    "aria-hidden": "true",
                    height: 30,
                    width: 30,
                  })}
                </span>
              </span>
              <span
                class="line-clamp-2 h-6 w-full flex-none break-all text-center text-[10px] font-medium leading-3"
              >
                ${item.name}
              </span>
            </a>`,
      )}
    </div>`;
  }

  private readonly handlePreviewClick = (event: MouseEvent): void => {
    this.previewImage(event.currentTarget);
  };

  private readonly handlePreviewKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this.previewImage(event.currentTarget);
  };

  private previewImage(target: EventTarget | null): void {
    if (!(target instanceof HTMLImageElement) || this.renderedBlock === null) return;
    const index = Number(target.dataset.index);
    const image = this.renderedBlock.items[index];
    if (image === undefined) return;

    new PhotoSwipe({
      bgClickAction: "close",
      dataSource: [
        {
          alt: image.alt,
          height: target.naturalHeight || image.height,
          src: image.src,
          width: target.naturalWidth || image.width,
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

void WalliAssetsGroupBlockElement;
