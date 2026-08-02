import { html, render as litRender, type TemplateResult } from "lit";
import type { BlockLayout } from "../../markdown-chat.model";

type ShellBlockLayout = Pick<
  BlockLayout,
  "height" | "markerClassName" | "markerLeft" | "markerText" | "quoteRailLefts" | "top"
>;

export type BlockRenderLayout<Block extends BlockLayout = BlockLayout> = {
  block: Block;
  contentInsetX: number;
};

export abstract class BlockShellElement<Block extends BlockLayout> extends HTMLElement {
  private currentLayout: BlockRenderLayout<Block> | null = null;

  set layout(layout: BlockRenderLayout<Block>) {
    this.currentLayout = layout;
    litRender(this.render(), this);
  }

  protected render(): TemplateResult | null {
    if (this.currentLayout === null) return null;

    const { block, contentInsetX } = this.currentLayout;
    return html`<div
      class="absolute left-0 w-full box-border"
      style=${`top:${block.top}px;height:${block.height}px;`}
    >
      ${this.renderQuoteRails(block, contentInsetX)}${this.renderMarker(
        block,
        contentInsetX,
      )}${this.renderContent(block, contentInsetX)}
    </div>`;
  }

  protected markerTop(_block: Block): number {
    return 0;
  }

  protected abstract renderContent(
    block: Block,
    contentInsetX: number,
  ): TemplateResult | TemplateResult[];

  private renderQuoteRails(block: ShellBlockLayout, contentInsetX: number): TemplateResult[] {
    return block.quoteRailLefts.map(
      (left) =>
        html`<div
          class="absolute top-0 bottom-0 w-[3px] rounded-full bg-muted-foreground opacity-20"
          style=${`left:${contentInsetX + left}px;`}
        ></div>`,
    );
  }

  private renderMarker(block: Block, contentInsetX: number): TemplateResult | null {
    if (block.markerText === null || block.markerLeft === null || block.markerClassName === null) {
      return null;
    }

    return html`<span
      class=${block.markerClassName}
      style=${`left:${contentInsetX + block.markerLeft}px;top:${this.markerTop(block)}px;`}
      .textContent=${block.markerText}
    ></span>`;
  }
}
