import { html, render, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { BlockLayout } from "../type";
import type { AnyCustomBlockDefinition } from "../custom-block";
import { BlockShellElement } from "./block-shell";

type CustomBlockLayout = Extract<BlockLayout, { kind: "custom" }>;
type CustomBlockContentLayout = {
  data: unknown;
  definition: AnyCustomBlockDefinition;
  height: number;
  width: number;
};

const customStyleSheetCache = new Map<string, CSSStyleSheet>();

@customElement("walli-custom-block-content")
export class WalliCustomBlockContentElement extends HTMLElement {
  private readonly contentElement = document.createElement("div");
  private readonly root: ShadowRoot;
  private readonly styleElement = document.createElement("style");
  private currentStyles = "";

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
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

function supportsConstructableStyleSheets(root: ShadowRoot): boolean {
  return "adoptedStyleSheets" in root && "replaceSync" in CSSStyleSheet.prototype;
}

function normalizeStyles(styles: string | readonly string[] | undefined): string {
  if (styles === undefined) return "";
  return typeof styles === "string" ? styles : styles.join("\n");
}

@customElement("walli-custom-block")
export class WalliCustomBlockElement extends BlockShellElement<CustomBlockLayout> {
  protected override renderContent(
    block: CustomBlockLayout,
    contentInsetX: number,
  ): TemplateResult {
    return html`<walli-custom-block-content
      class="absolute block overflow-hidden"
      style=${`left:${contentInsetX + block.contentLeft}px;top:0;width:${block.width}px;height:${block.height}px;`}
      .layout=${{
        data: block.data,
        definition: block.definition,
        height: block.height,
        width: block.width,
      }}
    ></walli-custom-block-content>`;
  }
}
