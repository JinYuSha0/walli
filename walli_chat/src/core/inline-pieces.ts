import type { Token } from "marked";
import {
  BODY_FRAGMENT_CLASS,
  BODY_LINE_HEIGHT,
  HEADING_ONE_FRAGMENT_CLASS,
  HEADING_ONE_LINE_HEIGHT,
  HEADING_TWO_FRAGMENT_CLASS,
  HEADING_TWO_LINE_HEIGHT,
  IMAGE_CHIP_FRAGMENT_CLASS,
  IMAGE_EXTRA_WIDTH,
  IMAGE_FONT,
  IMAGE_FRAGMENT_CLASS,
  INLINE_CODE_FRAGMENT_CLASS,
  INLINE_CODE_EXTRA_WIDTH,
  INLINE_CODE_FONT,
  LINK_FRAGMENT_CLASS,
  SANS_FAMILY,
  SERIF_FAMILY,
} from "./layout-config";
import { parseMarkdownHref } from "./markdown-url";

export type InlineVariant = "body" | "heading-1" | "heading-2";

export type MarkState = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  href: string | null;
};

export type InlinePiece = {
  breakMode: "normal" | "never";
  className: string;
  extraWidth: number;
  font: string;
  href: string | null;
  imageAlt: string | null;
  imageSrc: string | null;
  text: string;
};

export const EMPTY_MARK_STATE: MarkState = {
  bold: false,
  italic: false,
  strike: false,
  href: null,
};

export function collectInlinePieceLines(
  tokens: readonly Token[],
  variant: InlineVariant,
): InlinePiece[][] {
  const lines: InlinePiece[][] = [[]];

  function currentLine(): InlinePiece[] {
    return lines[lines.length - 1]!;
  }

  function pushLineBreak(): void {
    lines.push([]);
  }

  function pushPiece(piece: InlinePiece | null): void {
    if (piece === null) return;
    const line = currentLine();
    const previous = line[line.length - 1];
    if (previous !== undefined && canMergeInlinePieces(previous, piece)) {
      previous.text += piece.text;
      return;
    }
    line.push(piece);
  }

  function walk(tokenList: readonly Token[], marks: MarkState): void {
    for (let index = 0; index < tokenList.length; index++) {
      const token = tokenList[index]!;

      switch (token.type) {
        case "text": {
          if (Array.isArray(token.tokens) && token.tokens.length > 0) {
            walk(token.tokens, marks);
          } else {
            pushPiece(createTextPiece(token.text, marks, variant));
          }
          continue;
        }

        case "escape": {
          pushPiece(createTextPiece(token.text, marks, variant));
          continue;
        }

        case "strong": {
          walk(token.tokens ?? [], { ...marks, bold: true });
          continue;
        }

        case "em": {
          walk(token.tokens ?? [], { ...marks, italic: true });
          continue;
        }

        case "del": {
          walk(token.tokens ?? [], { ...marks, strike: true });
          continue;
        }

        case "codespan": {
          pushPiece(createCodePiece(token.text));
          continue;
        }

        case "link": {
          walk(token.tokens ?? [], { ...marks, href: parseMarkdownHref(token.href) });
          continue;
        }

        case "image": {
          pushPiece(createImagePiece(token.href, token.text));
          continue;
        }

        case "br": {
          pushLineBreak();
          continue;
        }

        case "checkbox": {
          pushPiece(createTextPiece(token.checked ? "[x] " : "[ ] ", marks, variant));
          continue;
        }

        case "html": {
          pushPiece(createTextPiece(token.text, marks, variant));
          continue;
        }

        default: {
          const fallback = fallbackTextForToken(token);
          if (fallback.length > 0) {
            pushPiece(createTextPiece(fallback, marks, variant));
          }
        }
      }
    }
  }

  walk(tokens, EMPTY_MARK_STATE);

  while (lines.length > 0 && lines[lines.length - 1]!.length === 0) {
    lines.pop();
  }

  return lines;
}

export function createTextPiece(
  text: string,
  marks: MarkState,
  variant: InlineVariant,
): InlinePiece | null {
  if (text.length === 0) return null;

  return {
    breakMode: "normal",
    className: resolveTextClassName(variant, marks),
    extraWidth: 0,
    font: resolveTextFont(variant, marks),
    href: marks.href,
    imageAlt: null,
    imageSrc: null,
    text,
  };
}

function createCodePiece(text: string): InlinePiece | null {
  if (text.length === 0) return null;

  return {
    breakMode: "normal",
    className: INLINE_CODE_FRAGMENT_CLASS,
    extraWidth: INLINE_CODE_EXTRA_WIDTH,
    font: INLINE_CODE_FONT,
    href: null,
    imageAlt: null,
    imageSrc: null,
    text,
  };
}

function createImagePiece(src: string | null | undefined, alt: string): InlinePiece {
  const safeSrc = parseMarkdownHref(src);
  const label = alt.length > 0 ? alt : "image";

  return {
    breakMode: "never",
    className: safeSrc === null ? IMAGE_CHIP_FRAGMENT_CLASS : IMAGE_FRAGMENT_CLASS,
    extraWidth: IMAGE_EXTRA_WIDTH,
    font: IMAGE_FONT,
    href: null,
    imageAlt: label,
    imageSrc: safeSrc,
    text: "image",
  };
}

function canMergeInlinePieces(a: InlinePiece, b: InlinePiece): boolean {
  return (
    a.breakMode === b.breakMode &&
    a.className === b.className &&
    a.extraWidth === b.extraWidth &&
    a.font === b.font &&
    a.href === b.href &&
    a.imageAlt === b.imageAlt &&
    a.imageSrc === b.imageSrc
  );
}

function resolveTextFont(variant: InlineVariant, marks: MarkState): string {
  const italicPrefix = marks.italic ? "italic " : "";

  switch (variant) {
    case "heading-1": {
      const weight = marks.bold ? 800 : 700;
      return `${italicPrefix}${weight} 20px ${SERIF_FAMILY}`;
    }

    case "heading-2": {
      const weight = marks.bold ? 800 : 700;
      return `${italicPrefix}${weight} 17px ${SERIF_FAMILY}`;
    }

    case "body": {
      const weight = marks.bold ? 700 : marks.href === null ? 400 : 500;
      return `${italicPrefix}${weight} 14px ${SANS_FAMILY}`;
    }
  }
}

function resolveTextClassName(variant: InlineVariant, marks: MarkState): string {
  let className = "";

  switch (variant) {
    case "heading-1":
      className = HEADING_ONE_FRAGMENT_CLASS;
      break;
    case "heading-2":
      className = HEADING_TWO_FRAGMENT_CLASS;
      break;
    case "body":
      className = BODY_FRAGMENT_CLASS;
      break;
  }

  if (marks.href !== null) className += ` ${LINK_FRAGMENT_CLASS}`;
  if (marks.bold) className += " font-bold";
  if (marks.italic) className += " italic";
  if (marks.strike) className += " line-through decoration-1";
  return className;
}

export function fallbackTextForToken(token: Token): string {
  if ("text" in token && typeof token.text === "string") return token.text;
  return token.raw ?? "";
}

export function headingVariant(depth: number): InlineVariant {
  if (depth <= 1) return "heading-1";
  if (depth === 2) return "heading-2";
  return "body";
}

export function lineHeightForVariant(variant: InlineVariant): number {
  switch (variant) {
    case "heading-1":
      return HEADING_ONE_LINE_HEIGHT;
    case "heading-2":
      return HEADING_TWO_LINE_HEIGHT;
    case "body":
      return BODY_LINE_HEIGHT;
  }
}
