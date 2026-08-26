import type { Token } from "marked";
import type { PreparedRichInline } from "@chenglou/pretext/rich-inline";
import type {
  BlockFrameBase,
  CoreBlockDefinition,
  ParseContext,
  PreparedBlock,
  PreparedBlockBase,
} from "../types";
import { createBlockBase, createBlockFrameBase } from "../helper";
import { getSpace } from "../styles/config";
import { collectInlinePieceLines, lineHeightForVariant } from "../inline-content";
import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  prepareRichInline,
  walkRichInlineLineRanges,
} from "@chenglou/pretext/rich-inline";
import { computed } from "@preact/signals-core";
import { customElement } from "lit/decorators.js";
import { BlockShellElement } from "../block-shell";
import { html, type TemplateResult } from "lit";

export type InlineVariant = "body" | "h1" | "h2";
export type InlinePiece = {
  breakMode: "normal" | "never";
  className: string;
  font: string;
  text: string;
  extraWidth?: number;
  href?: string;
  imageAlt?: string;
  imageHeight?: number;
  imageSrc?: string;
  imageWidth?: number;
};
export type MarkState = { bold: boolean; italic: boolean; strike: boolean; href?: string };
export type PreparedInlineItem = {
  className: string;
  href: string | null;
  image: { alt: string; height: number | null; src: string | null; width: number | null } | null;
};
export type PreparedInlineBlock = PreparedBlockBase & {
  kind: "inline";
  flow: PreparedRichInline;
  items: PreparedInlineItem[];
  lineHeight: number;
};
export type InlineFragmentLayout = {
  alt: string | null;
  className: string;
  href: string | null;
  kind: "image" | "text";
  imageHeight: number | null;
  imageWidth: number | null;
  leadingGap: number;
  src: string | null;
  text: string;
};
export type InlineBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "inline";
  lineHeight: number;
  lines: Array<{ fragments: InlineFragmentLayout[]; width: number }>;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  usedWidth: number;
};
export type InlineBlockFrame = BlockFrameBase & {
  kind: "inline";
  lineHeight: number;
  usedWidth: number;
};

const InlineBlockStyle = computed(() => ({
  hardBreakGap: getSpace(1),
}));

function getInlineBlockStyle(key: keyof (typeof InlineBlockStyle)["value"]) {
  return InlineBlockStyle.value[key];
}

export const inlineBlockDefinition = {
  name: "inline",
  prepare: buildInlineBlocks,
  measure(block, { availableWidth, top }) {
    const lineWidth = Math.max(1, availableWidth);
    const { lineCount, maxLineWidth } = measureRichInlineStats(block.flow, lineWidth);
    return {
      ...createBlockFrameBase(block, top),
      height: lineCount * block.lineHeight,
      kind: "inline",
      lineHeight: block.lineHeight,
      usedWidth: maxLineWidth,
    };
  },
  materialize(block, frame, { contentWidth }) {
    const lineWidth = Math.max(1, contentWidth - frame.contentLeft);
    const lines: Array<{ fragments: InlineFragmentLayout[]; width: number }> = [];
    walkRichInlineLineRanges(block.flow, lineWidth, (range) => {
      const line = materializeRichInlineLineRange(block.flow, range);
      lines.push({
        fragments: line.fragments.map((fragment) => {
          const item = block.items[fragment.itemIndex]!;
          return {
            alt: item.image?.alt ?? null,
            className: item.className,
            href: item.href,
            imageHeight: item.image?.height ?? null,
            imageWidth: item.image?.width ?? null,
            kind: item.image === null ? "text" : "image",
            leadingGap: fragment.gapBefore,
            src: item.image?.src ?? null,
            text: fragment.text,
          };
        }),
        width: line.width,
      });
    });
    return {
      contentLeft: frame.contentLeft,
      height: frame.height,
      kind: "inline",
      lineHeight: frame.lineHeight,
      lines,
      markerClassName: frame.markerClassName,
      markerLeft: frame.markerLeft,
      markerText: frame.markerText,
      quoteRailLefts: frame.quoteRailLefts,
      top: frame.top,
      usedWidth: frame.usedWidth,
    };
  },
  render: ({ block, contentInsetX }) =>
    html`<walli-inline-block .layout=${{ block, contentInsetX }}></walli-inline-block>`,
} satisfies CoreBlockDefinition<"inline", typeof buildInlineBlocks>;

function buildInlineBlocks(
  tokens: readonly Token[],
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedBlock[] {
  const lines = collectInlinePieceLines(tokens, variant);
  return buildPreparedInlineBlocks(lines, variant, ctx);
}

function buildPreparedInlineBlocks(
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
    flow: prepareRichInline(
      pieces.map((piece) => ({
        text: piece.text,
        font: piece.font,
        break: piece.breakMode,
        extraWidth: piece.extraWidth,
      })),
    ),
    items: pieces.map((piece) => ({
      className: piece.className,
      href: piece.href ?? null,
      image:
        piece.imageSrc === undefined
          ? null
          : {
              alt: piece.imageAlt ?? "",
              height: piece.imageHeight ?? null,
              src: piece.imageSrc ?? null,
              width: piece.imageWidth ?? null,
            },
    })),
    kind: "inline",
    lineHeight: lineHeightForVariant(variant),
  };
}

@customElement("walli-inline-block")
class WalliInlineBlockElement extends BlockShellElement<InlineBlockLayout> {
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

void WalliInlineBlockElement;
