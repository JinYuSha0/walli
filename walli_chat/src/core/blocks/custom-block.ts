import { html, render, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { createBlockFrameBase } from "../helper";
import type { BlockFrameBase, CoreBlockDefinition, PreparedBlockBase } from "../types";
import { BlockShellElement, type BlockRenderLayout } from "../block-shell";
import type { AnyCustomBlockDefinition, WalliChatBlockContext } from "../block-registry";

export type PreparedCustomBlock = PreparedBlockBase & {
  data: unknown;
  definition: AnyCustomBlockDefinition;
  kind: "custom";
};
export type CustomBlockLayout = {
  contentLeft: number;
  data: unknown;
  definition: AnyCustomBlockDefinition;
  height: number;
  kind: "custom";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  width: number;
};
export type CustomBlockFrame = BlockFrameBase & { kind: "custom"; width: number };
type CustomBlockRenderLayout = BlockRenderLayout<CustomBlockLayout> & {
  ctx: WalliChatBlockContext;
};

export const customBlockDefinition = {
  name: "custom",
  prepare(data: unknown, definition: AnyCustomBlockDefinition, base: PreparedBlockBase) {
    return {
      ...base,
      data: definition.prepare === undefined ? data : definition.prepare(data),
      definition,
      kind: "custom" as const,
    };
  },
  measure(block, { availableWidth, top }) {
    const metrics = block.definition.measure(block.data, { availableWidth });
    if (!Number.isFinite(metrics.height) || metrics.height < 0) {
      throw new Error(`Custom block "${block.definition.name}" returned an invalid height`);
    }
    if (metrics.width !== undefined && (!Number.isFinite(metrics.width) || metrics.width < 0)) {
      throw new Error(`Custom block "${block.definition.name}" returned an invalid width`);
    }
    return {
      ...createBlockFrameBase(block, top),
      height: metrics.height,
      kind: "custom",
      width: Math.max(0, Math.min(availableWidth, metrics.width ?? availableWidth)),
    };
  },
  materialize(block, frame) {
    return {
      contentLeft: frame.contentLeft,
      data:
        block.definition.materialize === undefined
          ? block.data
          : block.definition.materialize(block.data, {
              height: frame.height,
              width: frame.width,
            }),
      definition: block.definition,
      height: frame.height,
      kind: "custom",
      markerClassName: frame.markerClassName,
      markerLeft: frame.markerLeft,
      markerText: frame.markerText,
      quoteRailLefts: frame.quoteRailLefts,
      top: frame.top,
      width: frame.width,
    };
  },
  render: ({ block, contentInsetX, ctx }) =>
    html`<walli-custom-block .layout=${{ block, contentInsetX, ctx }}></walli-custom-block>`,
} satisfies CoreBlockDefinition<"custom">;

type CustomBlockContentLayout = {
  ctx: WalliChatBlockContext;
  data: unknown;
  definition: AnyCustomBlockDefinition;
  height: number;
  width: number;
};

const customStyleSheetCache = new Map<string, CSSStyleSheet>();

@customElement("walli-custom-block-content")
class WalliCustomBlockContentElement extends HTMLElement {
  private readonly contentElement = document.createElement("div");
  private readonly root: ShadowRoot;
  private readonly styleElement = document.createElement("style");
  private currentStyles = "";

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.contentElement.style.height = "100%";
    this.contentElement.style.position = "relative";
    this.contentElement.style.width = "100%";
    this.styleElement.setAttribute("data-walli-custom-block-styles", "");
    this.root.append(this.contentElement);
  }

  set layout(layout: CustomBlockContentLayout) {
    const styles = normalizeStyles(layout.definition.styles);
    if (styles !== this.currentStyles) {
      this.currentStyles = styles;
      this.applyStyles(styles);
    }

    render(
      layout.definition.render({
        contentInsetX: 0,
        ctx: layout.ctx,
        data: layout.data,
        height: layout.height,
        left: 0,
        top: 0,
        width: layout.width,
      }),
      this.contentElement,
    );
  }

  private applyStyles(styles: string): void {
    if (supportsConstructableStyleSheets(this.root)) {
      try {
        if (styles.length === 0) {
          this.root.adoptedStyleSheets = [];
        } else {
          let sheet = customStyleSheetCache.get(styles);
          if (sheet === undefined) {
            sheet = new CSSStyleSheet();
            sheet.replaceSync(styles);
            customStyleSheetCache.set(styles, sheet);
          }
          this.root.adoptedStyleSheets = [sheet];
        }
        this.styleElement.remove();
        return;
      } catch {
        this.root.adoptedStyleSheets = [];
      }
    }

    this.styleElement.textContent = styles;
    if (!this.styleElement.isConnected) {
      this.root.insertBefore(this.styleElement, this.contentElement);
    }
  }
}

void WalliCustomBlockContentElement;

function supportsConstructableStyleSheets(root: ShadowRoot): boolean {
  return "adoptedStyleSheets" in root && "replaceSync" in CSSStyleSheet.prototype;
}

function normalizeStyles(styles: string | readonly string[] | undefined): string {
  if (styles === undefined) return "";
  return typeof styles === "string" ? styles : styles.join("\n");
}

@customElement("walli-custom-block")
class WalliCustomBlockElement extends BlockShellElement<CustomBlockLayout> {
  private ctx: WalliChatBlockContext | null = null;

  override set layout(layout: CustomBlockRenderLayout) {
    this.ctx = layout.ctx;
    super.layout = layout;
  }

  protected override renderContent(
    block: CustomBlockLayout,
    contentInsetX: number,
  ): TemplateResult {
    const ctx = this.ctx!;
    return html`<walli-custom-block-content
      class="absolute block overflow-hidden"
      style=${`left:${contentInsetX + block.contentLeft}px;top:0;width:${block.width}px;height:${block.height}px;`}
      .layout=${{
        ctx,
        data: block.data,
        definition: block.definition,
        height: block.height,
        width: block.width,
      }}
    ></walli-custom-block-content>`;
  }
}

void WalliCustomBlockElement;
