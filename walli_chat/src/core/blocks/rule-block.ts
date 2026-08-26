import { computed } from "@preact/signals-core";
import { createBlockBase, createBlockFrameBase } from "../helper";
import { getSpace } from "../styles/config";
import type {
  BlockFrameBase,
  CoreBlockDefinition,
  ParseContext,
  PreparedBlockBase,
} from "../types";
import { customElement } from "lit/decorators.js";
import { BlockShellElement } from "../block-shell";
import { html, type TemplateResult } from "lit";

export type PreparedRuleBlock = PreparedBlockBase & {
  kind: "rule";
  height: number;
};
export type RuleBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "rule";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  width: number;
};
export type RuleBlockFrame = BlockFrameBase & { kind: "rule"; width: number };

const RuleBlockStyle = computed(() => ({
  ruleHeight: getSpace(4.5),
}));

function getRuleBlockStyle(key: keyof (typeof RuleBlockStyle)["value"]) {
  return RuleBlockStyle.value[key];
}

export const ruleBlockDefinition = {
  name: "rule",
  prepare: buildRuleBlock,
  measure(block, { availableWidth, top }) {
    return {
      ...createBlockFrameBase(block, top),
      height: block.height,
      kind: "rule",
      width: Math.max(1, availableWidth),
    };
  },
  materialize(_block, frame) {
    return {
      contentLeft: frame.contentLeft,
      height: frame.height,
      kind: "rule",
      markerClassName: frame.markerClassName,
      markerLeft: frame.markerLeft,
      markerText: frame.markerText,
      quoteRailLefts: frame.quoteRailLefts,
      top: frame.top,
      width: frame.width,
    };
  },
  render: ({ block, contentInsetX }) =>
    html`<walli-rule-block .layout=${{ block, contentInsetX }}></walli-rule-block>`,
} satisfies CoreBlockDefinition<"rule">;

function buildRuleBlock(ctx: ParseContext): PreparedRuleBlock {
  return {
    ...createBlockBase(ctx),
    height: getRuleBlockStyle("ruleHeight"),
    kind: "rule",
  };
}

@customElement("walli-rule-block")
class WalliRuleBlockElement extends BlockShellElement<RuleBlockLayout> {
  protected override renderContent(block: RuleBlockLayout, contentInsetX: number): TemplateResult {
    return html`<div
      class="absolute h-px bg-border"
      style=${`left:${contentInsetX + block.contentLeft}px; top:${Math.floor(block.height / 2)}px; width:${block.width}px;`}
    ></div>`;
  }
}

void WalliRuleBlockElement;
