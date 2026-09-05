import type { Token } from "marked";
import type { InlinePiece, InlineVariant, MarkState } from "./blocks/inline-block";
import { fallbackTextForToken, parseInlineImageDimensions, parseMarkdownHref } from "./helper";
import { inlinePiece } from "./styles";
import { getLineHeight } from "./styles/config";

const emptyMarkState: MarkState = {
  bold: false,
  italic: false,
  strike: false,
};

export function collectInlinePieceLines(
  tokens: readonly Token[],
  variant: InlineVariant,
): InlinePiece[][] {
  const lines: InlinePiece[][] = [[]];

  function currentLine(): InlinePiece[] {
    return lines[lines.length - 1]!;
  }

  function pushPiece(piece: InlinePiece | null): void {
    if (piece === null) return;
    const line = currentLine();
    const previous = line[line.length - 1];
    if (previous !== undefined && canMergeInlinePieces(previous, piece)) {
      previous.text += piece.text;
    } else {
      line.push(piece);
    }
  }

  function walk(tokenList: readonly Token[], marks: MarkState): void {
    for (let index = 0; index < tokenList.length; index++) {
      const token = tokenList[index]!;
      switch (token.type) {
        case "text":
          if (Array.isArray(token.tokens) && token.tokens.length > 0) walk(token.tokens, marks);
          else pushPiece(createTextPiece(token.text, marks, variant));
          break;
        case "escape":
          pushPiece(createTextPiece(token.text, marks, variant));
          break;
        case "strong":
          walk(token.tokens ?? [], { ...marks, bold: true });
          break;
        case "em":
          walk(token.tokens ?? [], { ...marks, italic: true });
          break;
        case "del":
          walk(token.tokens ?? [], { ...marks, strike: true });
          break;
        case "codespan":
          pushPiece(token.text.length === 0 ? null : inlinePiece.code(token.text));
          break;
        case "link":
          walk(token.tokens ?? [], { ...marks, href: parseMarkdownHref(token.href) });
          break;
        case "image": {
          const parsed = parseInlineImageDimensions(tokenList[index + 1]);
          const dimensions =
            parsed?.dimensions.width !== undefined && parsed.dimensions.height !== undefined
              ? { height: parsed.dimensions.height, width: parsed.dimensions.width }
              : null;
          pushPiece(
            inlinePiece.image(token.href, token.text, lineHeightForVariant(variant), dimensions),
          );
          if (parsed !== null) {
            index++;
            pushPiece(createTextPiece(parsed.remainder, marks, variant));
          }
          break;
        }
        case "br":
          lines.push([]);
          break;
        case "checkbox":
          pushPiece(createTextPiece(token.checked ? "[x] " : "[ ] ", marks, variant));
          break;
        case "html":
          pushPiece(createTextPiece(token.text, marks, variant));
          break;
        default: {
          const fallback = fallbackTextForToken(token);
          if (fallback.length > 0) pushPiece(createTextPiece(fallback, marks, variant));
        }
      }
    }
  }

  walk(tokens, emptyMarkState);
  while (lines.length > 0 && lines[lines.length - 1]!.length === 0) lines.pop();
  return lines;
}

export function lineHeightForVariant(variant: InlineVariant): number {
  switch (variant) {
    case "h1":
      return getLineHeight("text-xl");
    case "h2":
      return getLineHeight("text-lg");
    case "body":
      return getLineHeight("text-base");
    case "system":
      return getLineHeight("text-xs");
  }
}

function createTextPiece(
  text: string,
  marks: MarkState,
  variant: InlineVariant,
): InlinePiece | null {
  return text.length === 0 ? null : inlinePiece[variant](text, marks);
}

function canMergeInlinePieces(a: InlinePiece, b: InlinePiece): boolean {
  return (
    a.breakMode === b.breakMode &&
    a.className === b.className &&
    a.extraWidth === b.extraWidth &&
    a.font === b.font &&
    a.href === b.href &&
    a.imageAlt === b.imageAlt &&
    a.imageHeight === b.imageHeight &&
    a.imageSrc === b.imageSrc &&
    a.imageWidth === b.imageWidth
  );
}
