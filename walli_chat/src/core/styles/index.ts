import clsx from "clsx";
import type { InlineVariant, MarkState, InlinePiece } from "../type";
import { getFontSize, getResponsiveValue, getSpace } from "./config";
import { parseMarkdownImageSrc } from "../helper";
import { computed } from "@preact/signals-core";

const fontFamilyMap = {
  "font-sans":
    'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"',
  "font-serif": 'ui-serif,Georgia,Cambria,"Times New Roman",Times,serif',
  "font-mono":
    'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
};

export function getFont(
  variant: InlineVariant,
  marks: MarkState | null,
  size: Parameters<typeof getFontSize>[0],
  family: keyof typeof fontFamilyMap,
  fontWeight?: number,
) {
  let weight = fontWeight ?? 400;

  if (!fontWeight) {
    if (variant === "h1" || variant === "h2") {
      weight = marks?.bold ? 700 : 600;
    } else if (variant === "body") {
      if (marks?.bold) {
        weight = 700;
      } else if (marks?.href) {
        weight = 500;
      }
    }
  }

  return [
    marks?.italic ? "italic" : "",
    String(weight),
    `${getFontSize(size)}px`,
    fontFamilyMap[family],
  ]
    .filter(Boolean)
    .join(" ");
}

function processInlineTextClass(className: string, marks: MarkState) {
  return clsx(
    className,
    marks.href ? "underline" : null,
    marks.bold ? "font-bold" : null,
    marks.italic ? "italic" : null,
    marks.strike ? "line-through decoration-1" : null,
  );
}

function h1(text: string, marks: MarkState): InlinePiece {
  return {
    breakMode: "normal",
    className: processInlineTextClass(
      "inline-block whitespace-pre font-sans text-xl font-semibold leading-none text-foreground align-baseline",
      marks,
    ),
    font: getFont("h1", marks, "text-xl", "font-sans"),
    text,
    href: marks.href,
  };
}

function h2(text: string, marks: MarkState): InlinePiece {
  return {
    breakMode: "normal",
    className: processInlineTextClass(
      "inline-block whitespace-pre font-sans text-lg font-semibold leading-none text-foreground align-baseline",
      marks,
    ),
    font: getFont("h2", marks, "text-lg", "font-sans"),
    text,
    href: marks.href,
  };
}

function body(text: string, marks: MarkState): InlinePiece {
  return {
    breakMode: "normal",
    className: processInlineTextClass(
      "inline-block whitespace-pre font-sans text-base leading-none text-foreground align-baseline",
      marks,
    ),
    font: getFont("body", marks, "text-base", "font-sans"),
    text,
    href: marks.href,
  };
}

function code(text: string): InlinePiece {
  return {
    breakMode: "normal",
    className:
      "inline-block whitespace-pre bg-secondary rounded-[8px] px-[6px] pt-[2px] pb-[3px] font-mono text-sm font-semibold leading-none text-secondary-foreground align-baseline",
    font: getFont("body", null, "text-sm", "font-mono", 600),
    text,
    // fixme 跟着间距一起修复
    extraWidth: 12,
  };
}

function image(src: string | null | undefined, alt: string): InlinePiece {
  const safeSrc = parseMarkdownImageSrc(src);
  const label = alt.length > 0 ? alt : "image";

  return {
    breakMode: "never",
    className: !safeSrc
      ? "inline-flex min-h-[18px] translate-y-px items-center rounded-full bg-accent px-[7px] font-sans text-xs font-bold leading-none text-accent-foreground align-baseline"
      : "inline-block h-[18px] w-[48px] translate-y-px rounded-[6px] bg-muted object-cover align-baseline ring-1 ring-border",
    imageAlt: label,
    imageSrc: safeSrc,
    text: "image",
    font: getFont("body", null, "text-xs", "font-sans", 700),
    extraWidth: 14,
  };
}

function mark(): InlinePiece {
  return {
    breakMode: "normal",
    className:
      "absolute whitespace-pre font-mono text-xs font-semibold leading-none text-muted-foreground",
    font: getFont("body", null, "text-xs", "font-mono", 600),
    text: "",
  };
}

export const inlinePiece = {
  h1,
  h2,
  body,
  code,
  image,
  mark,
} as const;

const CommonStyle = computed(() => ({
  blockGap: getSpace(4),
  richBlockGap: getSpace(2),
  headingGap: getSpace(5),
  listNestingIndent: getSpace(5),
  blockQuoteIndent: getSpace(4.5),
  railOffset: getSpace(1.25),
  bubbleMaxRatio: getResponsiveValue({ base: 0.92, xl: 0.78 }),
  bubblePaddingX: getSpace(getResponsiveValue({ base: 2, xl: 4 })),
  bubblePaddingY: getSpace(2.5),
  messageSidePadding: getSpace(getResponsiveValue({ base: 2, xl: 5.5 })),
  messageGap: getSpace(4),
  assistantMessageActionHeight: getSpace(12.5),
  userMessageActionHeight: getSpace(10),
  userMessagePaddingTop: getSpace(2),
  topOcclusionHeight: getSpace(2),
  bottomOcclusionHeight: getSpace(2),
  scrollToBottomButtonBottom: getSpace(6),
  chatTopPadding: getSpace(4),
  chatBottomPadding: getSpace(6),
  maxChatWidth: getSpace(215),
  pageMargin: getSpace(getResponsiveValue({ base: 2, xl: 7 })),
}));

export function getCommonStyle(key: keyof typeof CommonStyle.value) {
  return CommonStyle.value[key];
}
