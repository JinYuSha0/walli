import {
  layoutWithLines,
  measureLineStats,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import { html } from "lit";
import type { WalliChatCustomBlockDefinition } from "walli_chat";
import noticeBlockCss from "./notice-block.css?inline";

const padding = 16;
const lineHeight = 22;
const font =
  '500 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const noticeBlockDefinition = {
  name: "notice",
  marginTop: 12,
  styles: noticeBlockCss,
  tokenizer: {
    tokenize(source) {
      const match = /^:::notice[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;
      return {
        data: { prepared: prepareWithSegments(match[1]!.trim(), font) },
        raw: match[0],
      };
    },
  },
  measure(data, { availableWidth }) {
    const contentWidth = Math.max(1, availableWidth - padding * 2);
    const { lineCount } = measureLineStats(data.prepared, contentWidth);
    return {
      height: padding * 2 + lineCount * lineHeight,
      width: availableWidth,
    };
  },
  render({ data, height, left, top, width }) {
    const contentWidth = Math.max(1, width - padding * 2);
    const layout = layoutWithLines(data.prepared, contentWidth, lineHeight);
    return html`<div
      class="notice"
      style=${`left:${left}px;top:${top}px;width:${width}px;height:${height}px;font:${font};`}
    >
      ${layout.lines.map(
        (line, index) => html`<div
          class="notice-line"
          style=${`left:${padding}px;top:${padding + index * lineHeight}px;height:${lineHeight}px;`}
        >${line.text}</div>`,
      )}
    </div>`;
  },
} satisfies WalliChatCustomBlockDefinition<{ prepared: PreparedTextWithSegments }>;
