import { html, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import type { BlockLayout } from "../../markdown-chat.model";
import { BlockShellElement } from "./block-shell";

type RuleBlockLayout = Extract<BlockLayout, { kind: "rule" }>;

@customElement("walli-rule-block")
export class WalliRuleBlockElement extends BlockShellElement<RuleBlockLayout> {
  protected override renderContent(
    block: RuleBlockLayout,
    contentInsetX: number,
  ): TemplateResult {
    return html`<div
      class="absolute h-px bg-border"
      style=${`left:${contentInsetX + block.contentLeft}px;top:${Math.floor(block.height / 2)}px;width:${block.width}px;`}
    ></div>`;
  }
}
