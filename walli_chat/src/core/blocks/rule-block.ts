import { computed } from "@preact/signals-core";
import { createBlockBase } from "../helper";
import { getSpace } from "../styles/config";
import type { BlockLayout, ParseContext, PreparedRuleBlock } from "../type";
import { customElement } from "lit/decorators.js";
import { BlockShellElement } from "./block-shell";
import { html, type TemplateResult } from "lit";

const RuleBlockStyle = computed(() => ({
  ruleHeight: getSpace(4.5),
}));

export function getRuleBlockStyle(key: keyof (typeof RuleBlockStyle)["value"]) {
  return RuleBlockStyle.value[key];
}

export function buildRuleBlock(ctx: ParseContext): PreparedRuleBlock {
  return {
    ...createBlockBase(ctx),
    height: getRuleBlockStyle("ruleHeight"),
    kind: "rule",
  };
}

type RuleBlockLayout = Extract<BlockLayout, { kind: "rule" }>;

@customElement("walli-rule-block")
export class WalliRuleBlockElement extends BlockShellElement<RuleBlockLayout> {
  protected override renderContent(block: RuleBlockLayout, contentInsetX: number): TemplateResult {
    return html`<div
      class="absolute h-px bg-border"
      style=${`left:${contentInsetX + block.contentLeft}px; top:${Math.floor(block.height / 2)}px; width:${block.width}px;`}
    ></div>`;
  }
}
