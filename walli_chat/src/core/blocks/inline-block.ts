import type { Token } from "marked";
import type {
  BlockLayout,
  InlineFragmentLayout,
  InlinePiece,
  InlineVariant,
  MarkState,
  ParseContext,
  PreparedBlock,
  PreparedInlineBlock,
} from "../type";
import { inlinePiece } from "../styles";
import {
  createBlockBase,
  fallbackTextForToken,
  parseImageDimensions,
  parseMarkdownHref,
} from "../helper";
import { getLineHeight, getSpace } from "../styles/config";
import { prepareRichInline } from "@chenglou/pretext/rich-inline";
import { computed } from "@preact/signals-core";
import { customElement } from "lit/decorators.js";
import { BlockShellElement } from "./block-shell";
import { html, type TemplateResult } from "lit";

const InlineBlockStyle = computed(() => ({
  hardBreakGap: getSpace(1),
}));

export function getInlineBlockStyle(key: keyof (typeof InlineBlockStyle)["value"]) {
  return InlineBlockStyle.value[key];
}

export function buildInlineBlocks(
  tokens: readonly Token[],
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedBlock[] {
  const lines = collectInlinePieceLines(tokens, variant);
  return buildPreparedInlineBlocks(lines, variant, ctx);
}

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
          const parsedDimensions = parseImageDimensions(tokenList[index + 1]);
          const dimensions =
            parsedDimensions?.width !== undefined && parsedDimensions.height !== undefined
              ? { height: parsedDimensions.height, width: parsedDimensions.width }
              : null;
          pushPiece(createImagePiece(token.href, token.text, variant, dimensions));
          if (parsedDimensions !== null) index++;
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

export const EMPTY_MARK_STATE: MarkState = {
  bold: false,
  italic: false,
  strike: false,
};

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

export function createTextPiece(
  text: string,
  marks: MarkState,
  variant: InlineVariant,
): InlinePiece | null {
  if (text.length === 0) return null;

  return inlinePiece[variant](text, marks);
}

function createCodePiece(text: string): InlinePiece | null {
  if (text.length === 0) return null;

  return inlinePiece.code(text);
}

function createImagePiece(
  src: string | null | undefined,
  alt: string,
  variant: InlineVariant,
  dimensions: { height: number; width: number } | null,
): InlinePiece {
  return inlinePiece.image(src, alt, lineHeightForVariant(variant), dimensions);
}

export function buildPreparedInlineBlocks(
  lines: InlinePiece[][],
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];

  for (let index = 0; index < lines.length; index++) {
    const block = buildPreparedInlineBlock(lines[index]!, variant, ctx);
    if (block === null) continue;
    blocks.push({
      ...block,
      marginTop: blocks.length === 0 ? 0 : getInlineBlockStyle("hardBreakGap"),
    } satisfies PreparedBlock);
  }

  return blocks;
}

function buildPreparedInlineBlock(
  pieces: InlinePiece[],
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedInlineBlock | null {
  if (pieces.length === 0) return null;

  return {
    ...createBlockBase(ctx),
    classNames: pieces.map((piece) => piece.className),
    flow: prepareRichInline(
      pieces.map((piece) => ({
        text: piece.text,
        font: piece.font,
        break: piece.breakMode,
        extraWidth: piece.extraWidth,
      })),
    ),
    hrefs: pieces.map((piece) => piece.href ?? null),
    imageAlts: pieces.map((piece) => piece.imageAlt ?? null),
    imageHeights: pieces.map((piece) => piece.imageHeight ?? null),
    imageSrcs: pieces.map((piece) => piece.imageSrc ?? null),
    imageWidths: pieces.map((piece) => piece.imageWidth ?? null),
    kind: "inline",
    lineHeight: lineHeightForVariant(variant),
  };
}

function lineHeightForVariant(variant: InlineVariant): number {
  switch (variant) {
    case "h1":
      return getLineHeight("text-xl");
    case "h2":
      return getLineHeight("text-lg");
    case "body":
      return getLineHeight("text-base");
  }
}

type InlineBlockLayout = Extract<BlockLayout, { kind: "inline" }>;

@customElement("walli-inline-block")
export class WalliInlineBlockElement extends BlockShellElement<InlineBlockLayout> {
  protected override markerTop(block: InlineBlockLayout): number {
    return Math.max(0, Math.round((block.lineHeight - 12) / 2));
  }

  protected override renderContent(
    block: InlineBlockLayout,
    contentInsetX: number,
  ): TemplateResult[] {
    return block.lines.map(
      (line, lineIndex) =>
        html`<div
          class="absolute flex w-max items-center gap-0"
          style=${`height:${block.lineHeight}px; left:${contentInsetX + block.contentLeft}px; top:${lineIndex * block.lineHeight}px;`}
        >
          ${line.fragments.map(renderInlineFragment)}
        </div>`,
    );
  }
}

function renderInlineFragment(fragment: InlineFragmentLayout): TemplateResult {
  const gapStyle = fragment.leadingGap > 0 ? `margin-left:${fragment.leadingGap}px;` : "";

  if (fragment.kind === "image" && fragment.src !== null) {
    return html`<img
      class=${fragment.className}
      src=${fragment.src}
      alt=${fragment.alt ?? ""}
      loading="lazy"
      decoding="async"
      style=${`${gapStyle}width:${fragment.imageWidth}px;height:${fragment.imageHeight}px;`}
    />`;
  }

  if (fragment.href !== null) {
    return html`<a
      class=${fragment.className}
      href=${fragment.href}
      target="_blank"
      rel="noreferrer"
      style=${gapStyle}
      .textContent=${fragment.text}
    ></a>`;
  }

  return html`<span
    class=${fragment.className}
    style=${gapStyle}
    .textContent=${fragment.text}
  ></span>`;
}
