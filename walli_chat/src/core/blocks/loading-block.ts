import { html } from "lit";
import type { WalliChatTokenizedBlockDefinition } from "./custom-block";
import { registerTokenizedBlock } from "./custom-block";

const loadingBlockDefinition = {
  name: "loading-block",
  measure: (_data, { availableWidth }) => ({
    height: 48,
    width: availableWidth,
  }),
  render: ({ height, left, top, width }) => html`
    <div
      style=${`align-items:center;display:flex;height:${height}px;justify-content:center;left:${left}px;position:absolute;top:${top}px;width:${width}px;`}
    >
      <walli-loading></walli-loading>
    </div>
  `,
  tokenizer: {
    tokenize(source) {
      const match = /^:::loading-block[ \t]*\n:::[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;
      return {
        data: undefined,
        raw: match[0],
      };
    },
  },
} satisfies WalliChatTokenizedBlockDefinition<undefined>;

let registered = false;

export function registerLoadingBlock(): void {
  if (registered) return;
  registered = true;
  registerTokenizedBlock(loadingBlockDefinition);
}

export { loadingBlockDefinition };
