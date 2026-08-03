import clsx from "clsx";
import type { InlineVariant, MarkState, InlinePiece } from "../type";
import { getFontSize, getSpace } from "./config";
import { parseMarkdownHref } from "../helper";
import { computed } from "@preact/signals-core";

const fontFamilyMap = {
  "font-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "font-serif": '"Iowan Old Style", Georgia, "Times New Roman", serif',
  "font-mono": '"SF Mono", ui-monospace, Menlo, Monaco, monospace',
};

function getFont(
  variant: InlineVariant,
  marks: MarkState | null,
  size: Parameters<typeof getFontSize>[0],
  family: keyof typeof fontFamilyMap,
  fontWeight?: number,
) {
  let weight = fontWeight ?? 400;

  if (!fontWeight) {
    if (variant === "h1" || variant === "h2") {
      weight = marks?.bold ? 800 : 700;
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
      "inline-block whitespace-pre font-serif text-xl font-bold leading-none text-foreground align-baseline",
      marks,
    ),
    font: getFont("h1", marks, "text-xl", "font-serif"),
    text,
    href: marks.href,
  };
}

function h2(text: string, marks: MarkState): InlinePiece {
  return {
    breakMode: "normal",
    className: processInlineTextClass(
      "inline-block whitespace-pre font-serif text-lg font-bold leading-none text-foreground align-baseline",
      marks,
    ),
    font: getFont("h2", marks, "text-lg", "font-serif"),
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
  const safeSrc = parseMarkdownHref(src);
  const label = alt.length > 0 ? alt : "image";

  return {
    breakMode: "never",
    className: !safeSrc
      ? "inline-flex min-h-[18px] translate-y-px items-center rounded-full bg-accent px-[7px] font-sans text-[11px] font-bold leading-none text-accent-foreground align-baseline"
      : "inline-block h-[18px] w-[48px] translate-y-px rounded-[6px] bg-muted object-cover align-baseline ring-1 ring-border",
    imageAlt: label,
    imageSrc: safeSrc,
    text: "image",
    font: getFont("body", null, "text-sm", "font-sans"),
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
  blockGap: getSpace(3),
  richBlockGap: getSpace(1),
  headingGap: getSpace(4),
  listNestingIndent: getSpace(4),
  blockQuoteIndent: getSpace(4),
  railOffset: getSpace(1),
  bubbleMaxRatio: 0.78,
  bubblePaddingX: getSpace(4),
  bubblePaddingY: getSpace(2.5),
  messageSidePadding: getSpace(2.5),
  messageGap: getSpace(3),
  occlusionBannerHeight: getSpace(15),
  chatTopPadding: getSpace(3.5),
  chatBottomPadding: getSpace(2.5),
  maxChatWidth: getSpace(215),
  pageMargin: getSpace(7),
}));

export function getCommonStyle(key: keyof typeof CommonStyle.value) {
  return CommonStyle.value[key];
}
