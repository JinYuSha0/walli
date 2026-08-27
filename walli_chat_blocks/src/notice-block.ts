import {
  layoutWithLines,
  measureLineStats,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import type { WalliChatTokenizedBlockDefinition } from "@walli/chat";
import { html } from "lit";
import { CircleCheck, CircleX, Info, createElement, type IconNode } from "lucide";
import { z } from "zod";
import { blockBaseStyles } from "./block-theme.js";
import walliChatBlocksUnoCss from "virtual:walli-chat-blocks-uno-styles";

const horizontalPadding = 14;
const verticalPadding = 12;
const iconSize = 24;
const iconTextGap = 10;
const lineHeight = 20;
const minimumHeight = 48;
const font = '500 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export type NoticeBlockVariant = "info" | "success" | "error";

export type NoticeBlockData = {
  text: string;
  variant?: NoticeBlockVariant;
};

type PreparedNoticeBlockData = {
  preparedText: PreparedTextWithSegments;
  text: string;
  variant: NoticeBlockVariant;
};

const noticeSchema = z.object({
  text: z.string().trim().min(1),
  variant: z.enum(["info", "success", "error"]).default("info"),
});

export const noticeBlockDefinition = {
  name: "notice",
  marginTop: 12,
  styles: [walliChatBlocksUnoCss, blockBaseStyles],
  tokenizer: {
    tokenize(source) {
      const match =
        /^:::notice(?:[ \t]+(info|success|error))?[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(
          source,
        );
      if (!match) return undefined;
      return {
        data: noticeSchema.parse({
          text: match[2],
          variant: match[1] ?? "info",
        }),
        raw: match[0],
      };
    },
  },
  prepare(data): PreparedNoticeBlockData {
    const parsed = noticeSchema.parse(data);
    return {
      preparedText: prepareWithSegments(parsed.text, font),
      text: parsed.text,
      variant: parsed.variant,
    };
  },
  measure(data, { availableWidth }) {
    const contentWidth = getContentWidth(availableWidth);
    const lineCount = measureLineStats(data.preparedText, contentWidth).lineCount;
    return {
      height: Math.max(minimumHeight, verticalPadding * 2 + lineCount * lineHeight),
      width: availableWidth,
    };
  },
  render({ data, height, width }) {
    const textLayout = layoutWithLines(data.preparedText, getContentWidth(width), lineHeight);
    const textLeft = horizontalPadding + iconSize + iconTextGap;
    const textTop = (height - textLayout.lines.length * lineHeight) / 2;
    return html`<div
      class=${
        data.variant === "success"
          ? "relative box-border h-full w-full overflow-hidden rounded-xl border border-solid [background:var(--walli-block-success-background)] [border-color:var(--walli-block-success)] font-sans text-sm font-medium leading-5 [color:var(--walli-block-success)]"
          : data.variant === "error"
            ? "relative box-border h-full w-full overflow-hidden rounded-xl border border-solid [background:var(--walli-block-error-background)] [border-color:var(--walli-block-error)] font-sans text-sm font-medium leading-5 [color:var(--walli-block-error)]"
            : "relative box-border h-full w-full overflow-hidden rounded-xl border border-solid [background:var(--walli-block-info-background)] [border-color:var(--walli-block-info)] font-sans text-sm font-medium leading-5 [color:var(--walli-block-info)]"
      }
      role=${data.variant === "error" ? "alert" : "status"}
      aria-label=${data.text}
    >
      <span
        class=${
          data.variant === "success"
            ? "absolute flex items-center justify-center [color:var(--walli-block-success)]"
            : data.variant === "error"
              ? "absolute flex items-center justify-center [color:var(--walli-block-error)]"
              : "absolute flex items-center justify-center [color:var(--walli-block-info)]"
        }
        style=${`left:${horizontalPadding}px;top:${(height - iconSize) / 2}px;width:${iconSize}px;height:${iconSize}px`}
        aria-hidden="true"
        >${renderIcon(data.variant)}</span
      >
      ${textLayout.lines.map(
        (line, index) =>
          html`<span
            class="absolute whitespace-pre"
            style=${`left:${textLeft}px;top:${textTop + index * lineHeight}px;height:${lineHeight}px`}
            aria-hidden="true"
            >${line.text}</span
          >`,
      )}
    </div>`;
  },
} satisfies WalliChatTokenizedBlockDefinition<NoticeBlockData, PreparedNoticeBlockData>;

export function createNoticeMarkdown(data: NoticeBlockData): string {
  const parsed = noticeSchema.parse(data);
  if (parsed.text.includes("\n:::")) {
    throw new Error('Notice text cannot contain a standalone ":::"');
  }
  return `:::notice ${parsed.variant}\n${parsed.text}\n:::`;
}

function getContentWidth(width: number): number {
  return Math.max(1, width - horizontalPadding * 2 - iconSize - iconTextGap);
}

function renderIcon(variant: NoticeBlockVariant) {
  const icon: IconNode =
    variant === "success" ? CircleCheck : variant === "error" ? CircleX : Info;
  return createElement(icon, {
    "aria-hidden": "true",
    height: 18,
    strokeWidth: 2,
    width: 18,
  });
}
