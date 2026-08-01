import type { BlockLayout } from "../../markdown-chat.model";
import "./code-block";
import "./image-block";
import "./inline-block";
import "./rule-block";
import type { WalliCodeBlockElement } from "./code-block";
import type { WalliImageBlockElement } from "./image-block";
import type { WalliInlineBlockElement } from "./inline-block";
import type { WalliRuleBlockElement } from "./rule-block";

export function createMessageBlockElement(
  block: BlockLayout,
  contentInsetX: number,
): HTMLElement {
  switch (block.kind) {
    case "inline": {
      const element = document.createElement("walli-inline-block") as WalliInlineBlockElement;
      element.layout = { block, contentInsetX };
      return element;
    }
    case "code": {
      const element = document.createElement("walli-code-block") as WalliCodeBlockElement;
      element.layout = { block, contentInsetX };
      return element;
    }
    case "image": {
      const element = document.createElement("walli-image-block") as WalliImageBlockElement;
      element.layout = { block, contentInsetX };
      return element;
    }
    case "rule": {
      const element = document.createElement("walli-rule-block") as WalliRuleBlockElement;
      element.layout = { block, contentInsetX };
      return element;
    }
  }
}
