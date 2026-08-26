import { parseMarkdownBlocks } from "./md-parse";
import type {
  BlockFrame,
  BlockLayout,
  ChatMessageInstance,
  ConversationFrame,
  MessageFrame,
  PreparedBlock,
  PreparedChatMessage,
} from "./types";
import { getCommonStyle } from "./styles";
import {
  materializeMessageBlockLayout,
  measureMessageBlockFrame,
  resolveBuiltInBlockDefinition,
} from "./block-registry";
import type { WalliChatMessage } from "../types";

export function createPreparedChatMessages(
  messages: readonly WalliChatMessage[],
  options: { streaming?: boolean } = {},
): PreparedChatMessage[] {
  return messages.map((seed) => {
    const blocks = parseMarkdownBlocks(seed.markdown, options.streaming);
    return {
      blocks: seed.role === "user" ? groupUserMessageAssets(blocks) : blocks,
      markdown: seed.markdown,
      id: seed.id,
      role: seed.role,
      showActions: seed.showActions ?? true,
      streaming: options.streaming || undefined,
    };
  });
}

function groupUserMessageAssets(blocks: readonly PreparedBlock[]): PreparedBlock[] {
  const assetsGroup = resolveBuiltInBlockDefinition("assetsGroup");
  const grouped: PreparedBlock[] = [];
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!;
    if (block.kind !== "image" && block.kind !== "assetsGroup") {
      grouped.push(block);
      continue;
    }

    const assets = block.kind === "assetsGroup" ? [...block.assets] : [block];
    let nextIndex = index + 1;
    while (blocks[nextIndex]?.kind === "image" || blocks[nextIndex]?.kind === "assetsGroup") {
      const next = blocks[nextIndex]!;
      if (next.kind === "assetsGroup") assets.push(...next.assets);
      else if (next.kind === "image") assets.push(next);
      nextIndex++;
    }
    grouped.push(assetsGroup.prepare(assets, block) as PreparedBlock);
    index = nextIndex - 1;
  }
  return grouped;
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
  composerBottomInsetHeight = 0,
): ConversationFrame {
  const laneWidth = Math.max(120, chatWidth - getCommonStyle("messageSidePadding") * 2);
  const userFrameWidth = Math.min(
    laneWidth,
    Math.max(240, Math.floor(chatWidth * getCommonStyle("bubbleMaxRatio"))),
  );
  const assistantFrameWidth = laneWidth;
  const messages: ChatMessageInstance[] = new Array(preparedMessages.length);
  const chatTopPadding = topOcclusionHeight + getCommonStyle("chatTopPadding");
  const chatBottomPadding =
    bottomOcclusionHeight + composerBottomInsetHeight + getCommonStyle("chatBottomPadding");

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
    if (preparedMessage.role === "assistant") {
      y += getCommonStyle("messageGap");
    }
  }

  const lastMessage = preparedMessages[preparedMessages.length - 1];
  const trailingMessageGap = lastMessage?.role === "assistant" ? getCommonStyle("messageGap") : 0;
  const totalHeight =
    messages.length === 0
      ? chatTopPadding + chatBottomPadding
      : y - trailingMessageGap + chatBottomPadding;

  return {
    bottomOcclusionHeight,
    chatWidth,
    composerBottomInsetHeight,
    messages,
    topOcclusionHeight,
    totalHeight,
  };
}

export function getBlockUsedWidth(block: BlockFrame | BlockLayout): number {
  switch (block.kind) {
    case "inline":
      return block.contentLeft + block.usedWidth;
    case "code":
    case "image":
    case "assetsGroup":
    case "rule":
    case "table":
    case "custom":
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
    const blockFrame = measureMessageBlockFrame(block, maxContentWidth, y);
    blocks.push(blockFrame);
    y += blockFrame.height;
    usedContentWidth = Math.max(usedContentWidth, getBlockUsedWidth(blockFrame));
  }

  const bubbleHeight = y + getCommonStyle("bubblePaddingY");
  const actionHeight =
    preparedMessage.streaming || !preparedMessage.showActions
      ? 0
      : preparedMessage.role === "assistant"
        ? getCommonStyle("assistantMessageActionHeight")
        : getCommonStyle("userMessageActionHeight");
  const paddingTop = preparedMessage.role === "user" ? getCommonStyle("userMessagePaddingTop") : 0;
  const frameWidth =
    preparedMessage.role === "assistant"
      ? maxFrameWidth
      : Math.min(maxFrameWidth, contentInsetX * 2 + Math.max(1, usedContentWidth));
  return {
    actionHeight,
    blocks,
    bubbleHeight,
    contentInsetX,
    frameWidth,
    layoutContentWidth: maxContentWidth,
    role: preparedMessage.role,
    totalHeight: bubbleHeight + paddingTop + actionHeight,
    paddingTop,
  };
}

export function materializeMessageBlocks(message: ChatMessageInstance): BlockLayout[] {
  return message.prepared.blocks.map((block, index) =>
    materializeMessageBlockLayout(
      block,
      message.frame.blocks[index]!,
      message.frame.layoutContentWidth,
    ),
  );
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
