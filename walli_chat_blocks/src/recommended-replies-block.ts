import type { WalliChatBlockContext, WalliChatTokenizedBlockDefinition } from "@walli/chat";
import {
  layoutWithLines,
  measureLineStats,
  measureNaturalWidth,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import { html } from "lit";
import { blockBaseStyles } from "./block-theme.js";
import walliChatBlocksUnoCss from "virtual:walli-chat-blocks-uno-styles";

const minimumButtonHeight = 42;
const buttonGap = 8;
const containerInset = 6;
const horizontalContentInset = 15;
const verticalContentInset = 10;
const lineHeight = 20;
const font = '500 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export type RecommendedRepliesData = {
  replies: readonly string[];
};

type PreparedReply = {
  naturalWidth: number;
  preparedText: PreparedTextWithSegments;
  text: string;
};

type PreparedRecommendedRepliesData = {
  replies: readonly PreparedReply[];
};

/** Replies used when a recommended-replies block has no body. */
export const defaultRecommendedReplies = [
  "Tell me more",
  "Give me an example",
  "What should I do next?",
] as const;

const styles = [walliChatBlocksUnoCss, blockBaseStyles];

export const recommendedRepliesBlockDefinition = {
  name: "recommended-replies",
  marginTop: 12,
  styles,
  tokenizer: {
    tokenize(source) {
      const match = /^:::recommended-replies[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;

      const replies = parseReplies(match[1] ?? "");
      return {
        data: { replies: replies.length > 0 ? replies : defaultRecommendedReplies },
        raw: match[0],
      };
    },
  },
  prepare(data): PreparedRecommendedRepliesData {
    return {
      replies: data.replies.map((text) => prepareReply(text)),
    };
  },
  measure(data, { availableWidth }) {
    const innerWidth = getInnerWidth(availableWidth);
    const repliesHeight = data.replies.reduce(
      (height, reply) => height + getReplyMetrics(reply, innerWidth).height,
      0,
    );
    return {
      height: repliesHeight + Math.max(0, data.replies.length - 1) * buttonGap + containerInset * 2,
      width: availableWidth,
    };
  },
  render({ ctx, data, width }) {
    const disabled = ctx.isStreaming;
    const innerWidth = getInnerWidth(width);
    return html`<div
      class="box-border flex h-full w-full flex-col items-start gap-2 p-1.5"
      aria-label="Recommended replies"
    >
      ${data.replies.map((reply) => {
        const metrics = getReplyMetrics(reply, innerWidth);
        const textLayout = layoutWithLines(reply.preparedText, metrics.contentWidth, lineHeight);
        const textTop = (metrics.height - textLayout.lines.length * lineHeight) / 2;
        return html`<button
          class="[-webkit-appearance:none] relative box-border block max-w-full shrink-0 cursor-pointer overflow-hidden rounded-xl border border-solid [background:var(--walli-card)] [border-color:var(--walli-border)] p-0 text-left font-sans text-sm font-medium leading-5 [box-shadow:var(--walli-recommended-reply-shadow)] [color:var(--walli-card-foreground)] transition-[background-color,opacity] duration-150 enabled:hover:[background:var(--walli-accent)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--walli-ring)] disabled:cursor-not-allowed disabled:opacity-48"
          style=${`width:${metrics.width}px;height:${metrics.height}px`}
          type="button"
          title=${reply.text}
          aria-label=${reply.text}
          ?disabled=${disabled}
          @click=${(event: MouseEvent) => submitReply(event, ctx, reply.text)}
        >
          ${textLayout.lines.map(
            (line, index) =>
              html`<span
                aria-hidden="true"
                class="pointer-events-none absolute left-3.5 whitespace-pre"
                style=${`top:${textTop + index * lineHeight}px;height:${lineHeight}px`}
                >${line.text}</span
              >`,
          )}
        </button>`;
      })}
    </div>`;
  },
} satisfies WalliChatTokenizedBlockDefinition<
  RecommendedRepliesData,
  PreparedRecommendedRepliesData
>;

/** Creates the Markdown consumed by {@link recommendedRepliesBlockDefinition}. */
export function createRecommendedRepliesMarkdown(
  replies: readonly string[] = defaultRecommendedReplies,
): string {
  const normalized = normalizeReplies(replies);
  if (normalized.length === 0) {
    return ":::recommended-replies\n\n:::";
  }
  if (normalized.some((reply) => reply === ":::" || reply.includes("\n"))) {
    throw new Error('Recommended replies cannot contain newlines or a standalone ":::"');
  }
  return `:::recommended-replies\n${normalized.map((reply) => `- ${reply}`).join("\n")}\n:::`;
}

function parseReplies(body: string): string[] {
  return normalizeReplies(body.split("\n").map((line) => line.replace(/^\s*[-*]\s+/, "")));
}

function normalizeReplies(replies: readonly string[]): string[] {
  return replies.map((reply) => reply.trim()).filter((reply) => reply.length > 0);
}

function getContentWidth(buttonWidth: number): number {
  return Math.max(1, buttonWidth - horizontalContentInset * 2);
}

function getInnerWidth(availableWidth: number): number {
  return Math.max(1, availableWidth - containerInset * 2);
}

function getButtonHeight(lineCount: number): number {
  return Math.max(minimumButtonHeight, lineCount * lineHeight + verticalContentInset * 2);
}

function prepareReply(text: string): PreparedReply {
  const preparedText = prepareWithSegments(text, font);
  return {
    naturalWidth: measureNaturalWidth(preparedText),
    preparedText,
    text,
  };
}

function getReplyMetrics(
  reply: PreparedReply,
  availableWidth: number,
): { contentWidth: number; height: number; width: number } {
  const width = Math.min(
    availableWidth,
    Math.ceil(reply.naturalWidth + horizontalContentInset * 2),
  );
  const contentWidth = getContentWidth(width);
  return {
    contentWidth,
    height: getButtonHeight(measureLineStats(reply.preparedText, contentWidth).lineCount),
    width,
  };
}

async function submitReply(
  event: MouseEvent,
  ctx: WalliChatBlockContext,
  reply: string,
): Promise<void> {
  if (ctx.isStreaming) return;

  const button = event.currentTarget as HTMLButtonElement;
  const container = button.parentElement;
  const buttons = container?.querySelectorAll("button") ?? [];
  buttons.forEach((item) => {
    item.disabled = true;
  });

  ctx.scrollTo({ animated: false, target: "bottom" });
  const submitted = await ctx.submit(reply);
  if (!submitted && !ctx.isStreaming) {
    buttons.forEach((item) => {
      item.disabled = false;
    });
  }
}
