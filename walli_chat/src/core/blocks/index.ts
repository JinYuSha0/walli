import { html, type TemplateResult } from "lit";
import type { BlockLayout } from "../type";

export { buildInlineBlocks, WalliInlineBlockElement } from "./inline-block";
export { buildCodeBlock, WalliCodeBlockElement } from "./code-block";
export { buildRuleBlock, WalliRuleBlockElement } from "./rule-block";
export { buildImageBlock, WalliImageBlockElement } from "./image-block";
export { buildPlainTextBlocks } from "./plain-text-block";
export { buildListBlocks } from "./list-block";
export { buildTableBlock } from "./table-block";

export function renderMessageBlockTemplate(
  block: BlockLayout,
  contentInsetX: number,
): TemplateResult {
  switch (block.kind) {
    case "inline":
      return html`<walli-inline-block .layout=${{ block, contentInsetX }}></walli-inline-block>`;
    case "code":
      return html`<walli-code-block .layout=${{ block, contentInsetX }}></walli-code-block>`;
    case "image":
      return html`<walli-image-block .layout=${{ block, contentInsetX }}></walli-image-block>`;
    case "rule":
      return html`<walli-rule-block .layout=${{ block, contentInsetX }}></walli-rule-block>`;
  }
}
