import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import { html, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { createElement } from "lucide";
import type { BlockLayout } from "../type";
import { getFileIcon } from "../file-icon";
import { BlockShellElement } from "./block-shell";

type AssetsGroupBlockLayout = Extract<BlockLayout, { kind: "assetsGroup" }>;

@customElement("walli-assets-group-block")
export class WalliAssetsGroupBlockElement extends BlockShellElement<AssetsGroupBlockLayout> {
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
