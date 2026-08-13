import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  walkRichInlineLineRanges,
} from "@chenglou/pretext/rich-inline";
import { parseMarkdownBlocks } from "./md-parse";
import type {
  BlockFrame,
  BlockLayout,
  ChatMessageInstance,
  ConversationFrame,
  InlineFragmentLayout,
  MessageFrame,
  PreparedBlock,
  PreparedChatMessage,
} from "./type";
import { layoutWithLines, measureLineStats } from "@chenglou/pretext";
import { getCommonStyle } from "./styles";
import { getCodeBlockStyle } from "./blocks/code-block";
import { getImageBlockStyle } from "./blocks/image-block";
import { materializeTableCells, measureTableBlock } from "./blocks/table-block";
import type { WalliChatMessage } from "../types";

export function createPreparedChatMessages(
  messages: readonly WalliChatMessage[],
): PreparedChatMessage[] {
  return messages.map((seed) => ({
    blocks: parseMarkdownBlocks(seed.markdown),
    role: seed.role,
  }));
}

export function getMaxChatWidth(viewportWidth: number): number {
  return Math.max(
    240,
    Math.min(getCommonStyle("maxChatWidth"), viewportWidth - getCommonStyle("pageMargin") * 2),
  );
}

export function buildConversationFrame(
  preparedMessages: readonly PreparedChatMessage[],
  chatWidth: number,
  topOcclusionHeight: number = getCommonStyle("topOcclusionHeight"),
  bottomOcclusionHeight: number = getCommonStyle("bottomOcclusionHeight"),
): ConversationFrame {
  const laneWidth = Math.max(120, chatWidth - getCommonStyle("messageSidePadding") * 2);
  const userFrameWidth = Math.min(
    laneWidth,
    Math.max(240, Math.floor(chatWidth * getCommonStyle("bubbleMaxRatio"))),
  );
  const assistantFrameWidth = laneWidth;
  const messages: ChatMessageInstance[] = new Array(preparedMessages.length);
  const chatTopPadding = topOcclusionHeight + getCommonStyle("chatTopPadding");
  const chatBottomPadding = bottomOcclusionHeight + getCommonStyle("chatBottomPadding");

  let y = chatTopPadding;
  for (let ordinal = 0; ordinal < preparedMessages.length; ordinal++) {
    const preparedMessage = preparedMessages[ordinal]!;
    const contentInsetX =
      preparedMessage.role === "assistant" ? 0 : getCommonStyle("bubblePaddingX");
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
    y += getCommonStyle("messageGap");
  }

  const totalHeight =
    messages.length === 0
      ? chatTopPadding + chatBottomPadding
      : y - getCommonStyle("messageGap") + chatBottomPadding;

  return {
    bottomOcclusionHeight,
    chatWidth,
    messages,
    topOcclusionHeight,
    totalHeight,
  };
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
    case "table":
      return block.contentLeft + block.width;
  }
}

function layoutMessageFrame(
  preparedMessage: PreparedChatMessage,
  maxFrameWidth: number,
  maxContentWidth: number,
  contentInsetX: number,
): MessageFrame {
  let y = getCommonStyle("bubblePaddingY");
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

  const bubbleHeight = y + getCommonStyle("bubblePaddingY");
  const paddingTop =
    preparedMessage.role === "user" ? getCommonStyle("userMessagePaddingTop") : 0;
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
    totalHeight: bubbleHeight + paddingTop,
    paddingTop,
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
      const innerWidth = Math.max(
        1,
        boxWidth -
          getCodeBlockStyle("paddingLeft") -
          getCodeBlockStyle("paddingRight") -
          getCodeBlockStyle("actionWidth"),
      );
      const { lineCount } = measureLineStats(block.prepared, innerWidth);
      return {
        contentLeft: block.contentLeft,
        height:
          lineCount * block.lineHeight +
          getCodeBlockStyle("paddingTop") +
          getCodeBlockStyle("paddingBottom"),
        kind: "code",
        lineHeight: block.lineHeight,
        markerClassName: block.markerClassName,
        markerLeft: block.markerLeft,
        markerText: block.markerText,
        quoteRailLefts: block.quoteRailLefts,
        top,
        width: boxWidth,
      };
    }

    case "image": {
      const availableWidth = Math.max(1, contentWidth - block.contentLeft);
      const preferredWidth = block.targetWidth ?? availableWidth;
      const width = Math.max(1, Math.round(Math.min(availableWidth, preferredWidth)));
      return {
        contentLeft: block.contentLeft,
        height: Math.max(
          1,
          Math.round(block.targetHeight ?? getImageBlockStyle("imageBlockHeight")),
        ),
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

    case "table": {
      const metrics = measureTableBlock(block, Math.max(1, contentWidth - block.contentLeft));
      return {
        contentLeft: block.contentLeft,
        height: metrics.height,
        kind: "table",
        lineHeight: block.lineHeight,
        markerClassName: block.markerClassName,
        markerLeft: block.markerLeft,
        markerText: block.markerText,
        quoteRailLefts: block.quoteRailLefts,
        tableWidth: metrics.width,
        top,
        width: metrics.viewportWidth,
      };
    }
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
      const innerWidth = Math.max(
        1,
        boxWidth -
          getCodeBlockStyle("paddingLeft") -
          getCodeBlockStyle("paddingRight") -
          getCodeBlockStyle("actionWidth"),
      );
      const layout = layoutWithLines(block.prepared, innerWidth, frame.lineHeight);
      return {
        contentLeft: frame.contentLeft,
        height: frame.height,
        kind: "code",
        language: block.language,
        lines: layout.lines,
        markerClassName: frame.markerClassName,
        markerLeft: frame.markerLeft,
        markerText: frame.markerText,
        quoteRailLefts: frame.quoteRailLefts,
        text: block.text,
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

    case "table": {
      if (block.kind !== "table") throw new Error("Table block/frame mismatch");
      const metrics = measureTableBlock(block, Math.max(1, contentWidth - frame.contentLeft));
      return {
        cells: materializeTableCells(block, metrics),
        columnWidths: metrics.columnWidths,
        contentLeft: frame.contentLeft,
        height: frame.height,
        kind: "table",
        markerClassName: frame.markerClassName,
        markerLeft: frame.markerLeft,
        markerText: frame.markerText,
        quoteRailLefts: frame.quoteRailLefts,
        viewportWidth: frame.width,
        top: frame.top,
        width: metrics.width,
      };
    }
  }
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
