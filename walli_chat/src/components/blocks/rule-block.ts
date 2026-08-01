import { customElement } from "lit/decorators.js";
import type { BlockLayout } from "../../markdown-chat.model";
import { createBlockShell } from "./block-shell";

type RuleBlockLayout = Extract<BlockLayout, { kind: "rule" }>;

const RULE_LINE_CLASS = "absolute h-px bg-border";

@customElement("walli-rule-block")
export class WalliRuleBlockElement extends HTMLElement {
  set layout(layout: { block: RuleBlockLayout; contentInsetX: number }) {
    const { block, contentInsetX } = layout;
    const wrapper = createBlockShell(block, contentInsetX);
    const rule = document.createElement("div");
    rule.className = RULE_LINE_CLASS;
    rule.style.left = `${contentInsetX + block.contentLeft}px`;
    rule.style.top = `${Math.floor(block.height / 2)}px`;
    rule.style.width = `${block.width}px`;
    wrapper.append(rule);
    this.replaceChildren(wrapper);
  }
}
