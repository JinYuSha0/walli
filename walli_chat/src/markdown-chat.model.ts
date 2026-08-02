import { marked, type Token, type Tokens } from "marked";

import {
  layoutWithLines,
  measureLineStats,
  measureNaturalWidth,
  prepareWithSegments,
  type LayoutLine,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  prepareRichInline,
  walkRichInlineLineRanges,
  type PreparedRichInline,
} from "@chenglou/pretext/rich-inline";
import {
  BLOCK_GAP,
  BLOCKQUOTE_INDENT,
  BUBBLE_MAX_RATIO,
  BUBBLE_PADDING_X,
  BUBBLE_PADDING_Y,
  CHAT_BOTTOM_PADDING_OFFSET,
  CHAT_TOP_PADDING_OFFSET,
  CODE_BLOCK_PADDING_X,
  CODE_BLOCK_PADDING_Y,
  CODE_LINE_HEIGHT,
  COMPACT_OCCLUSION_BANNER_HEIGHT,
  COMPACT_OCCLUSION_VIEWPORT_HEIGHT,
  DEFAULT_IMAGE_ASPECT_RATIO,
  HARD_BREAK_GAP,
  IMAGE_BLOCK_WIDTH_RATIO,
  LIST_ITEM_GAP,
  LIST_MARKER_GAP,
  LIST_NESTING_INDENT,
  MARKER_CLASS,
  MARKER_FONT,
  MAX_CHAT_WIDTH,
  MESSAGE_GAP,
  MESSAGE_SIDE_PADDING,
  MONO_FAMILY,
  OCCLUSION_BANNER_HEIGHT,
  PAGE_MARGIN,
  RAIL_OFFSET,
  RICH_BLOCK_GAP,
  RULE_HEIGHT,
  TOTAL_MESSAGE_COUNT,
} from "./core/layout-config";
export {
  BUBBLE_PADDING_X,
  CHAT_VIEWPORT_HEIGHT,
  CODE_BLOCK_PADDING_X,
  CODE_BLOCK_PADDING_Y,
  CODE_LINE_HEIGHT,
  DEFAULT_CHAT_WIDTH,
  MAX_CHAT_WIDTH,
  MESSAGE_SIDE_PADDING,
  MIN_CHAT_WIDTH,
  OCCLUSION_BANNER_HEIGHT,
  PAGE_MARGIN,
  TOTAL_MESSAGE_COUNT,
} from "./core/layout-config";
import {
  collectInlinePieceLines,
  createTextPiece,
  EMPTY_MARK_STATE,
  fallbackTextForToken,
  headingVariant,
  type InlinePiece,
  type InlineVariant,
  lineHeightForVariant,
} from "./core/inline-pieces";
import { parseMarkdownHref } from "./core/markdown-url";
import { BASE_MESSAGE_SPECS } from "./mock/markdown-chat.data";

type ParseContext = {
  listDepth: number;
  quoteDepth: number;
};

type PreparedBlockBase = {
  contentLeft: number;
  marginTop: number;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
};

type PreparedInlineBlock = PreparedBlockBase & {
  kind: "inline";
  classNames: string[];
  flow: PreparedRichInline;
  hrefs: Array<string | null>;
  imageAlts: Array<string | null>;
  imageSrcs: Array<string | null>;
  lineHeight: number;
};

type PreparedCodeBlock = PreparedBlockBase & {
  kind: "code";
  lineHeight: number;
  prepared: PreparedTextWithSegments;
};

type PreparedImageBlock = PreparedBlockBase & {
  alt: string;
  aspectRatio: number;
  kind: "image";
  src: string;
};

type PreparedRuleBlock = PreparedBlockBase & {
  kind: "rule";
  height: number;
};

type PreparedBlock =
  PreparedInlineBlock | PreparedCodeBlock | PreparedImageBlock | PreparedRuleBlock;

export type PreparedChatMessage = {
  blocks: PreparedBlock[];
  role: "assistant" | "user";
};

export type InlineFragmentLayout = {
  alt: string | null;
  className: string;
  href: string | null;
  kind: "image" | "text";
  leadingGap: number;
  src: string | null;
  text: string;
};

type BlockFrameBase = {
  contentLeft: number;
  height: number;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
};

type InlineBlockFrame = BlockFrameBase & {
  kind: "inline";
  lineHeight: number;
  usedWidth: number;
};

type CodeBlockFrame = BlockFrameBase & {
  kind: "code";
  lineHeight: number;
  width: number;
};

type ImageBlockFrame = BlockFrameBase & {
  kind: "image";
  width: number;
};

type RuleBlockFrame = BlockFrameBase & {
  kind: "rule";
  width: number;
};

type BlockFrame = InlineBlockFrame | CodeBlockFrame | ImageBlockFrame | RuleBlockFrame;

type InlineBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "inline";
  lineHeight: number;
  lines: Array<{
    fragments: InlineFragmentLayout[];
    width: number;
  }>;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  usedWidth: number;
};

type CodeBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "code";
  lines: LayoutLine[];
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  usedWidth: number;
  width: number;
};

type ImageBlockLayout = {
  alt: string;
  contentLeft: number;
  height: number;
  kind: "image";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  src: string;
  top: number;
  width: number;
};

type RuleBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "rule";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  width: number;
};

export type BlockLayout = InlineBlockLayout | CodeBlockLayout | ImageBlockLayout | RuleBlockLayout;

export type MessageFrame = {
  blocks: BlockFrame[];
  bubbleHeight: number;
  contentInsetX: number;
  frameWidth: number;
  layoutContentWidth: number;
  role: "assistant" | "user";
  totalHeight: number;
};

export type ChatMessageInstance = {
  bottom: number;
  prepared: PreparedChatMessage;
  frame: MessageFrame;
  top: number;
};

export type ConversationFrame = {
  chatWidth: number;
  messages: ChatMessageInstance[];
  occlusionBannerHeight: number;
  totalHeight: number;
};

const markerWidthCache = new Map<string, number>();

export function createPreparedChatMessages(): PreparedChatMessage[] {
  const messages = new Array<PreparedChatMessage>(TOTAL_MESSAGE_COUNT);
  for (let index = 0; index < messages.length; index++) {
    const seed = BASE_MESSAGE_SPECS[index % BASE_MESSAGE_SPECS.length]!;
    messages[index] = {
      blocks: parseMarkdownBlocks(seed.markdown),
      role: seed.role,
    };
  }
  return messages;
}

export function getMaxChatWidth(viewportWidth: number): number {
  return Math.max(240, Math.min(MAX_CHAT_WIDTH, viewportWidth - PAGE_MARGIN * 2));
}

export function buildConversationFrame(
  preparedMessages: readonly PreparedChatMessage[],
  chatWidth: number,
  occlusionBannerHeight: number = OCCLUSION_BANNER_HEIGHT,
): ConversationFrame {
  const laneWidth = Math.max(120, chatWidth - MESSAGE_SIDE_PADDING * 2);
  const userFrameWidth = Math.min(
    laneWidth,
    Math.max(240, Math.floor(chatWidth * BUBBLE_MAX_RATIO)),
  );
  const assistantFrameWidth = laneWidth;
  const messages: ChatMessageInstance[] = new Array(preparedMessages.length);
  const chatTopPadding = occlusionBannerHeight + CHAT_TOP_PADDING_OFFSET;
  const chatBottomPadding = occlusionBannerHeight + CHAT_BOTTOM_PADDING_OFFSET;

  let y = chatTopPadding;
  for (let ordinal = 0; ordinal < preparedMessages.length; ordinal++) {
    const preparedMessage = preparedMessages[ordinal]!;
    const contentInsetX = preparedMessage.role === "assistant" ? 0 : BUBBLE_PADDING_X;
    const frameWidth = preparedMessage.role === "assistant" ? assistantFrameWidth : userFrameWidth;
    const contentWidth = Math.max(120, frameWidth - contentInsetX * 2);
    const messageFrame = layoutMessageFrame(
      preparedMessage,
      frameWidth,
      contentWidth,
      contentInsetX,
    );
    const top = y;
    const bottom = top + messageFrame.totalHeight;

    messages[ordinal] = {
      bottom,
      frame: messageFrame,
      prepared: preparedMessage,
      top,
    };
    y = bottom;
    y += MESSAGE_GAP;
  }

  const totalHeight =
    messages.length === 0
      ? chatTopPadding + chatBottomPadding
      : y - MESSAGE_GAP + chatBottomPadding;

  return {
    chatWidth,
    messages,
    occlusionBannerHeight,
    totalHeight,
  };
}

export function getOcclusionBannerHeight(viewportHeight: number): number {
  return viewportHeight <= COMPACT_OCCLUSION_VIEWPORT_HEIGHT
    ? COMPACT_OCCLUSION_BANNER_HEIGHT
    : OCCLUSION_BANNER_HEIGHT;
}

export function findVisibleRange(
  frame: ConversationFrame,
  scrollTop: number,
  viewportHeight: number,
  topOcclusionHeight: number,
  bottomOcclusionHeight: number,
): {
  end: number;
  start: number;
} {
  if (frame.messages.length === 0) return { start: 0, end: 0 };

  const minY = Math.max(0, scrollTop + topOcclusionHeight);
  const maxY = Math.max(minY, scrollTop + viewportHeight - bottomOcclusionHeight);
  let low = 0;
  let high = frame.messages.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (frame.messages[mid]!.bottom > minY) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  const start = low;

  low = start;
  high = frame.messages.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (frame.messages[mid]!.top >= maxY) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return { start, end: low };
}

export function formatPixelCount(value: number): string {
  return `${Math.round(value).toLocaleString()}px`;
}

function parseMarkdownBlocks(markdown: string): PreparedBlock[] {
  const tokens = marked.lexer(markdown, { gfm: true });
  return parseBlockTokens(tokens, { listDepth: 0, quoteDepth: 0 });
}

function parseBlockTokens(tokens: readonly Token[], ctx: ParseContext): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;

    switch (token.type) {
      case "space":
      case "def": {
        continue;
      }

      case "paragraph": {
        const imageBlock = buildImageBlockFromParagraph(token.tokens ?? [], ctx);
        appendBlockGroup(
          blocks,
          imageBlock === null ? buildInlineBlocks(token.tokens ?? [], "body", ctx) : [imageBlock],
          BLOCK_GAP,
        );
        continue;
      }

      case "heading": {
        appendBlockGroup(
          blocks,
          buildInlineBlocks(token.tokens ?? [], headingVariant(token.depth), ctx),
          BLOCK_GAP + 4,
        );
        continue;
      }

      case "code": {
        appendBlockGroup(blocks, [buildCodeBlock(token.text, ctx)], RICH_BLOCK_GAP);
        continue;
      }

      case "list": {
        appendBlockGroup(blocks, buildListBlocks(token as Tokens.List, ctx), BLOCK_GAP);
        continue;
      }

      case "blockquote": {
        appendBlockGroup(
          blocks,
          parseBlockTokens(token.tokens ?? [], {
            listDepth: ctx.listDepth,
            quoteDepth: ctx.quoteDepth + 1,
          }),
          RICH_BLOCK_GAP,
        );
        continue;
      }

      case "hr": {
        appendBlockGroup(blocks, [buildRuleBlock(ctx)], BLOCK_GAP + 2);
        continue;
      }

      case "table": {
        appendBlockGroup(
          blocks,
          [buildCodeBlock(formatTable(token as Tokens.Table), ctx)],
          RICH_BLOCK_GAP,
        );
        continue;
      }

      case "html": {
        const htmlText = token.text.trim().length > 0 ? token.text : token.raw;
        const isPre = "pre" in token && token.pre === true;
        if (token.block || isPre) {
          appendBlockGroup(blocks, [buildCodeBlock(htmlText, ctx)], RICH_BLOCK_GAP);
        } else {
          appendBlockGroup(blocks, buildPlainTextBlocks(htmlText, "body", ctx), BLOCK_GAP);
        }
        continue;
      }

      case "text": {
        if (Array.isArray(token.tokens) && token.tokens.length > 0) {
          appendBlockGroup(blocks, buildInlineBlocks(token.tokens, "body", ctx), BLOCK_GAP);
        } else {
          appendBlockGroup(blocks, buildPlainTextBlocks(token.text, "body", ctx), BLOCK_GAP);
        }
        continue;
      }

      default: {
        const fallbackText = fallbackTextForToken(token);
        if (fallbackText.length > 0) {
          appendBlockGroup(blocks, buildPlainTextBlocks(fallbackText, "body", ctx), BLOCK_GAP);
        }
      }
    }
  }

  return blocks;
}

function buildListBlocks(token: Tokens.List, ctx: ParseContext): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];
  const itemCtx: ParseContext = {
    listDepth: ctx.listDepth + 1,
    quoteDepth: ctx.quoteDepth,
  };

  for (let index = 0; index < token.items.length; index++) {
    const item = token.items[index]!;
    let itemBlocks = parseBlockTokens(item.tokens, itemCtx);
    if (itemBlocks.length === 0) {
      itemBlocks = buildPlainTextBlocks(item.text, "body", itemCtx);
    }

    decorateListItemBlocks(
      itemBlocks,
      resolveListMarkerText(token, item, index),
      resolveListMarkerClassName(token, item),
    );
    appendBlockGroup(blocks, itemBlocks, LIST_ITEM_GAP);
  }

  return blocks;
}

function decorateListItemBlocks(
  blocks: PreparedBlock[],
  markerText: string,
  markerClassName: string,
): void {
  if (blocks.length === 0) return;

  const markerArea = measureMarkerWidth(markerText) + LIST_MARKER_GAP;
  for (let index = 0; index < blocks.length; index++) {
    blocks[index] = shiftBlock(blocks[index]!, markerArea);
  }

  const firstBlock = blocks[0]!;
  blocks[0] = {
    ...firstBlock,
    markerClassName,
    markerLeft: firstBlock.contentLeft - markerArea,
    markerText,
  } satisfies PreparedBlock;
}

function buildPlainTextBlocks(
  text: string,
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedBlock[] {
  const piece = createTextPiece(text, EMPTY_MARK_STATE, variant);
  if (piece === null) return [];
  return buildPreparedInlineBlocks([[piece]], variant, ctx);
}

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
      marginTop: blocks.length === 0 ? 0 : HARD_BREAK_GAP,
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
    hrefs: pieces.map((piece) => piece.href),
    imageAlts: pieces.map((piece) => piece.imageAlt),
    imageSrcs: pieces.map((piece) => piece.imageSrc),
    kind: "inline",
    lineHeight: lineHeightForVariant(variant),
  };
}

function buildCodeBlock(text: string, ctx: ParseContext): PreparedCodeBlock {
  return {
    ...createBlockBase(ctx),
    kind: "code",
    lineHeight: CODE_LINE_HEIGHT,
    prepared: prepareWithSegments(stripSingleTrailingNewline(text), `500 12px ${MONO_FAMILY}`, {
      whiteSpace: "pre-wrap",
    }),
  };
}

function buildImageBlockFromParagraph(
  tokens: readonly Token[],
  ctx: ParseContext,
): PreparedImageBlock | null {
  if (tokens.length !== 1) return null;

  const token = tokens[0]!;
  if (token.type !== "image") return null;

  const src = parseMarkdownHref(token.href);
  if (src === null) return null;

  return {
    ...createBlockBase(ctx),
    alt: token.text.length > 0 ? token.text : "image",
    aspectRatio: resolveImageAspectRatio(src),
    kind: "image",
    src,
  };
}

function buildRuleBlock(ctx: ParseContext): PreparedRuleBlock {
  return {
    ...createBlockBase(ctx),
    height: RULE_HEIGHT,
    kind: "rule",
  };
}

function resolveImageAspectRatio(src: string): number {
  const match = src.match(/\/(\d{2,5})\/(\d{2,5})(?:[/?#]|$)/);
  if (match === null) return DEFAULT_IMAGE_ASPECT_RATIO;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_IMAGE_ASPECT_RATIO;
  }

  return width / height;
}

function createBlockBase(ctx: ParseContext): PreparedBlockBase {
  const listIndent = Math.max(0, ctx.listDepth - 1) * LIST_NESTING_INDENT;
  const contentLeft = listIndent + ctx.quoteDepth * BLOCKQUOTE_INDENT;
  const quoteRailLefts: number[] = [];

  for (let depth = 0; depth < ctx.quoteDepth; depth++) {
    quoteRailLefts.push(listIndent + depth * BLOCKQUOTE_INDENT + RAIL_OFFSET);
  }

  return {
    contentLeft,
    marginTop: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteRailLefts,
  };
}

function appendBlockGroup(
  target: PreparedBlock[],
  group: PreparedBlock[],
  firstMargin: number,
): void {
  if (group.length === 0) return;

  for (let index = 0; index < group.length; index++) {
    const block = group[index]!;
    target.push({
      ...block,
      marginTop: index === 0 ? (target.length === 0 ? 0 : firstMargin) : block.marginTop,
    } satisfies PreparedBlock);
  }
}

function shiftBlock(block: PreparedBlock, delta: number): PreparedBlock {
  return {
    ...block,
    contentLeft: block.contentLeft + delta,
  } satisfies PreparedBlock;
}

function resolveListMarkerText(list: Tokens.List, item: Tokens.ListItem, index: number): string {
  if (item.task) return item.checked ? "☑" : "☐";
  if (list.ordered) {
    const start = typeof list.start === "number" ? list.start : 1;
    return `${start + index}.`;
  }
  return "•";
}

function resolveListMarkerClassName(_list: Tokens.List, item: Tokens.ListItem): string {
  if (item.task) return MARKER_CLASS;
  return MARKER_CLASS;
}

function measureMarkerWidth(text: string): number {
  const cached = markerWidthCache.get(text);
  if (cached !== undefined) return cached;

  const width = measureNaturalWidth(prepareWithSegments(text, MARKER_FONT));
  markerWidthCache.set(text, width);
  return width;
}

function formatTable(token: Tokens.Table): string {
  const header = token.header.map((cell) => inlineTokensToPlainText(cell.tokens)).join(" | ");
  const divider = token.header.map(() => "---").join(" | ");
  const rows = token.rows.map((row) =>
    row.map((cell) => inlineTokensToPlainText(cell.tokens)).join(" | "),
  );
  return [header, divider, ...rows].join("\n");
}

function inlineTokensToPlainText(tokens: readonly Token[]): string {
  let text = "";
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    switch (token.type) {
      case "strong":
      case "em":
      case "del":
      case "link":
        text += inlineTokensToPlainText(token.tokens ?? []);
        break;
      case "codespan":
      case "escape":
      case "text":
      case "html":
        text += token.text;
        break;
      case "br":
        text += "\n";
        break;
      case "image":
        text += token.text;
        break;
      default:
        text += fallbackTextForToken(token);
    }
  }
  return text;
}

function stripSingleTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

function layoutMessageFrame(
  preparedMessage: PreparedChatMessage,
  maxFrameWidth: number,
  maxContentWidth: number,
  contentInsetX: number,
): MessageFrame {
  let y = BUBBLE_PADDING_Y;
  const blocks: BlockFrame[] = [];
  let usedContentWidth = 0;

  for (let index = 0; index < preparedMessage.blocks.length; index++) {
    const block = preparedMessage.blocks[index]!;
    y += block.marginTop;
    const blockFrame = layoutBlockFrame(block, maxContentWidth, y);
    blocks.push(blockFrame);
    y += blockFrame.height;
    usedContentWidth = Math.max(usedContentWidth, getUsedBlockWidth(blockFrame));
  }

  const bubbleHeight = y + BUBBLE_PADDING_Y;
  const frameWidth =
    preparedMessage.role === "assistant"
      ? maxFrameWidth
      : Math.min(maxFrameWidth, contentInsetX * 2 + Math.max(1, usedContentWidth));
  return {
    blocks,
    bubbleHeight,
    contentInsetX,
    frameWidth,
    layoutContentWidth: maxContentWidth,
    role: preparedMessage.role,
    totalHeight: bubbleHeight,
  };
}

function layoutBlockFrame(block: PreparedBlock, contentWidth: number, top: number): BlockFrame {
  switch (block.kind) {
    case "inline": {
      const lineWidth = Math.max(1, contentWidth - block.contentLeft);
      const { lineCount, maxLineWidth } = measureRichInlineStats(block.flow, lineWidth);
      return {
        contentLeft: block.contentLeft,
        height: lineCount * block.lineHeight,
        kind: "inline",
        lineHeight: block.lineHeight,
        markerClassName: block.markerClassName,
        markerLeft: block.markerLeft,
        markerText: block.markerText,
        quoteRailLefts: block.quoteRailLefts,
        top,
        usedWidth: maxLineWidth,
      };
    }

    case "code": {
      const boxWidth = Math.max(1, contentWidth - block.contentLeft);
      const innerWidth = Math.max(1, boxWidth - CODE_BLOCK_PADDING_X * 2);
      const { lineCount, maxLineWidth } = measureLineStats(block.prepared, innerWidth);
      return {
        contentLeft: block.contentLeft,
        height: lineCount * block.lineHeight + CODE_BLOCK_PADDING_Y * 2,
        kind: "code",
        lineHeight: block.lineHeight,
        markerClassName: block.markerClassName,
        markerLeft: block.markerLeft,
        markerText: block.markerText,
        quoteRailLefts: block.quoteRailLefts,
        top,
        width: maxLineWidth + CODE_BLOCK_PADDING_X * 2,
      };
    }

    case "image": {
      const availableWidth = Math.max(1, contentWidth - block.contentLeft);
      const width = Math.max(1, Math.round(availableWidth * IMAGE_BLOCK_WIDTH_RATIO));
      return {
        contentLeft: block.contentLeft,
        height: Math.max(1, Math.round(width / block.aspectRatio)),
        kind: "image",
        markerClassName: block.markerClassName,
        markerLeft: block.markerLeft,
        markerText: block.markerText,
        quoteRailLefts: block.quoteRailLefts,
        top,
        width,
      };
    }

    case "rule": {
      return {
        contentLeft: block.contentLeft,
        height: block.height,
        kind: "rule",
        markerClassName: block.markerClassName,
        markerLeft: block.markerLeft,
        markerText: block.markerText,
        quoteRailLefts: block.quoteRailLefts,
        top,
        width: Math.max(1, contentWidth - block.contentLeft),
      };
    }
  }
}

function getUsedBlockWidth(block: BlockFrame): number {
  switch (block.kind) {
    case "inline":
      return block.contentLeft + block.usedWidth;
    case "code":
      return block.contentLeft + block.width;
    case "image":
      return block.contentLeft + block.width;
    case "rule":
      return block.contentLeft + block.width;
  }
}

export function materializeMessageBlocks(message: ChatMessageInstance): BlockLayout[] {
  return message.prepared.blocks.map((block, index) =>
    materializeBlockLayout(block, message.frame.blocks[index]!, message.frame.layoutContentWidth),
  );
}

function materializeBlockLayout(
  block: PreparedBlock,
  frame: BlockFrame,
  contentWidth: number,
): BlockLayout {
  switch (frame.kind) {
    case "inline": {
      if (block.kind !== "inline") throw new Error("Inline block/frame mismatch");
      const lineWidth = Math.max(1, contentWidth - frame.contentLeft);
      const lines: Array<{ fragments: InlineFragmentLayout[]; width: number }> = [];
      walkRichInlineLineRanges(block.flow, lineWidth, (range) => {
        const line = materializeRichInlineLineRange(block.flow, range);
        lines.push({
          fragments: line.fragments.map((fragment) => ({
            alt: block.imageAlts[fragment.itemIndex] ?? null,
            className: block.classNames[fragment.itemIndex]!,
            href: block.hrefs[fragment.itemIndex] ?? null,
            kind: block.imageSrcs[fragment.itemIndex] === null ? "text" : "image",
            leadingGap: fragment.gapBefore,
            src: block.imageSrcs[fragment.itemIndex] ?? null,
            text: fragment.text,
          })),
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
    }

    case "code": {
      if (block.kind !== "code") throw new Error("Code block/frame mismatch");
      const boxWidth = Math.max(1, contentWidth - frame.contentLeft);
      const innerWidth = Math.max(1, boxWidth - CODE_BLOCK_PADDING_X * 2);
      const layout = layoutWithLines(block.prepared, innerWidth, frame.lineHeight);
      return {
        contentLeft: frame.contentLeft,
        height: frame.height,
        kind: "code",
        lines: layout.lines,
        markerClassName: frame.markerClassName,
        markerLeft: frame.markerLeft,
        markerText: frame.markerText,
        quoteRailLefts: frame.quoteRailLefts,
        top: frame.top,
        usedWidth: frame.width,
        width: frame.width,
      };
    }

    case "image": {
      if (block.kind !== "image") throw new Error("Image block/frame mismatch");
      return {
        alt: block.alt,
        contentLeft: frame.contentLeft,
        height: frame.height,
        kind: "image",
        markerClassName: frame.markerClassName,
        markerLeft: frame.markerLeft,
        markerText: frame.markerText,
        quoteRailLefts: frame.quoteRailLefts,
        src: block.src,
        top: frame.top,
        width: frame.width,
      };
    }

    case "rule": {
      if (block.kind !== "rule") throw new Error("Rule block/frame mismatch");
      return {
        contentLeft: frame.contentLeft,
        height: frame.height,
        kind: "rule",
        markerClassName: frame.markerClassName,
        markerLeft: frame.markerLeft,
        markerText: frame.markerText,
        quoteRailLefts: frame.quoteRailLefts,
        top: frame.top,
        width: frame.width,
      };
    }
  }
}
