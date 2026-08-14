import { html, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { BlockLayout } from "../type";
import { BlockShellElement } from "./block-shell";

type CustomBlockLayout = Extract<BlockLayout, { kind: "custom" }>;

@customElement("walli-custom-block")
export class WalliCustomBlockElement extends BlockShellElement<CustomBlockLayout> {
  protected override renderContent(
    block: CustomBlockLayout,
    contentInsetX: number,
  ): TemplateResult {
    return html`${block.definition.render({
      contentInsetX,
      data: block.data,
      height: block.height,
      left: contentInsetX + block.contentLeft,
      top: 0,
      width: block.width,
    })}`;
  }
}
