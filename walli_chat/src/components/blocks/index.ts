import { html, type TemplateResult } from "lit";
import type { BlockLayout } from "../../markdown-chat.model";
import "./code-block";
import "./image-block";
import "./inline-block";
import "./rule-block";

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
