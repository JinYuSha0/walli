import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import { html, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { BlockLayout } from "../type";
import { BlockShellElement } from "./block-shell";

type ImageGroupBlockLayout = Extract<BlockLayout, { kind: "imageGroup" }>;

@customElement("walli-image-group-block")
export class WalliImageGroupBlockElement extends BlockShellElement<ImageGroupBlockLayout> {
  private renderedBlock: ImageGroupBlockLayout | null = null;

  protected override renderContent(
    block: ImageGroupBlockLayout,
    _contentInsetX: number,
  ): TemplateResult {
    this.renderedBlock = block;
    return html`<div
      class="absolute right-0 top-0"
      style=${`width:${block.width}px;height:${block.height}px;`}
    >
      ${block.images.map(
        (image, index) =>
          html`<img
            class="pointer-events-auto absolute block cursor-zoom-in rounded-[10px] bg-muted object-cover ring-1 ring-border"
            src=${image.src}
            alt=${image.alt}
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            role="button"
            tabindex="0"
            data-index=${index}
            style=${`left:${image.left}px;top:${image.top}px;width:${image.width}px;height:${image.height}px;object-fit:${image.crop ? "cover" : "contain"};transform:translateZ(0);backface-visibility:hidden;`}
            @click=${this.handlePreviewClick}
            @keydown=${this.handlePreviewKeydown}
          />`,
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
    const image = this.renderedBlock.images[index];
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
