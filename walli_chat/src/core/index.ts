import { editBlockStateKey } from "./blocks/edit-block";
import {
  parseInlineMarkdownBlocks,
  parseMarkdownBlocks,
  parseUserMarkdownBlocks,
  prepareRoleMessageBlock,
} from "./md-parse";
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
  resolveRoleBlockDefinition,
  measureMessageBlockFrame,
  materializeMessageBlockLayout,
  renderMessageBlockTemplate,
  type WalliChatBlockContext,
} from "./block-registry";
import { createSystemMessage } from "./blocks/system-block";
import { formatTimeSystemMessage } from "./helper";
import type { WalliChatMessage, WalliChatMessageRole, WalliChatTimeFormatter } from "../types";

type TimeSystemMessageOptions = {
  formatter?: WalliChatTimeFormatter;
  intervalSeconds: number;
};

export type MessageLayoutCache = Map<
  string,
  {
    prepared: PreparedChatMessage;
    width: number;
    frame: MessageFrame;
  }
>;

export function createPreparedChatMessages(
  messages: readonly WalliChatMessage[],
  options: { bottomPaddingHeight?: number; streaming?: boolean } = {},
): PreparedChatMessage[] {
  return messages.map((seed) => {
    let blocks = prepareRoleMessageBlock(seed.markdown, seed.role);
    if (!blocks) {
      switch (seed.role) {
        case "system":
          blocks = parseInlineMarkdownBlocks(seed.markdown, "body", seed.role);
          break;
        case "user":
          blocks = parseUserMarkdownBlocks(seed.markdown, options.streaming);
          break;
        default:
          blocks = parseMarkdownBlocks(seed.markdown, options.streaming, seed.role);
      }
    }

    return {
      blocks,
      meta: seed.meta,
      bottomPaddingHeight: options.bottomPaddingHeight,
      createdAt: seed.createdAt,
      markdown: seed.markdown,
      id: seed.id,
      role: seed.role,
      showActions: seed.showActions ?? true,
      streaming: options.streaming || undefined,
    };
  });
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
  timeOptions?: TimeSystemMessageOptions,
  layoutCache: MessageLayoutCache = new Map(),
  getBlockState?: WalliChatBlockContext["getBlockState"],
): ConversationFrame {
  const laneWidth = Math.max(120, chatWidth - getCommonStyle("messageSidePadding") * 2);
  const userFrameWidth = Math.min(
    laneWidth,
    Math.max(240, Math.floor(chatWidth * getCommonStyle("bubbleMaxRatio"))),
  );
  const assistantFrameWidth = laneWidth;
  const messages: ChatMessageInstance[] = [];
  const sourceMessages: ChatMessageInstance[] = [];
  const chatTopPadding = topOcclusionHeight + getCommonStyle("chatTopPadding");
  const chatBottomPadding =
    bottomOcclusionHeight + composerBottomInsetHeight + getCommonStyle("chatBottomPadding");

  let y = chatTopPadding;
  const appendMessage = (preparedMessage: PreparedChatMessage): ChatMessageInstance => {
    const isEditing = getBlockState?.(preparedMessage.id, editBlockStateKey) !== undefined;
    const useUserLayout = preparedMessage.role === "user" && !isEditing;
    const frameWidth = useUserLayout ? userFrameWidth : assistantFrameWidth;
    const contentWidth =
      preparedMessage.role === "user"
        ? Math.max(120, userFrameWidth - getCommonStyle("bubblePaddingX") * 2)
        : frameWidth;
    const cached = layoutCache.get(preparedMessage.id);
    const messageFrame =
      cached?.prepared === preparedMessage && cached.width === frameWidth
        ? cached.frame
        : layoutMessageFrame(preparedMessage, frameWidth, contentWidth);
    layoutCache.set(preparedMessage.id, {
      prepared: preparedMessage,
      width: frameWidth,
      frame: messageFrame,
    });
    const top = y;
    const bottom = top + messageFrame.totalHeight;

    const message = {
      bottom,
      frame: messageFrame,
      prepared: preparedMessage,
      top,
    };
    messages.push(message);
    y = bottom + getMessageGap(preparedMessage, getBlockState);
    return message;
  };

  let previousUserMessage: PreparedChatMessage | undefined;
  for (let ordinal = 0; ordinal < preparedMessages.length; ordinal++) {
    const preparedMessage = preparedMessages[ordinal]!;
    const previousMessage = preparedMessages[ordinal - 1];
    const systemMessage = createTimeSystemMessage(
      preparedMessage,
      previousUserMessage,
      timeOptions,
      layoutCache,
    );
    if (systemMessage !== undefined) {
      y -= getMessageGap(previousMessage, getBlockState);
      appendMessage(systemMessage);
    }
    const message = appendMessage(preparedMessage);
    if (preparedMessage.role !== "system") sourceMessages.push(message);
    if (preparedMessage.role === "user") previousUserMessage = preparedMessage;
  }

  const lastMessage = preparedMessages[preparedMessages.length - 1];
  const messageIds = new Set(messages.map((message) => message.prepared.id));
  for (const id of layoutCache.keys()) {
    if (!messageIds.has(id)) layoutCache.delete(id);
  }
  const totalHeight =
    messages.length === 0
      ? chatTopPadding + chatBottomPadding
      : y - getMessageGap(lastMessage, getBlockState) + chatBottomPadding;

  return {
    bottomOcclusionHeight,
    chatWidth,
    composerBottomInsetHeight,
    messages,
    sourceMessages,
    topOcclusionHeight,
    totalHeight,
  };
}

export function getBlockUsedWidth(block: BlockFrame | BlockLayout): number {
  switch (block.kind) {
    case "inline":
      return block.contentLeft + block.usedWidth;
    case "bubble":
    case "code":
    case "image":
    case "assetsGroup":
    case "rule":
    case "table":
    case "custom":
      return block.contentLeft + block.width;
  }
}

function layoutBlocks(
  prepared: readonly PreparedBlock[],
  width: number,
  top = 0,
  meta?: unknown,
  availableWidth = width,
) {
  let y = top;
  let usedWidth = 0;
  const blocks = prepared.map((block) => {
    y += block.marginTop;
    const frame = measureMessageBlockFrame(block, width, y, meta, availableWidth);
    y += frame.height;
    usedWidth = Math.max(usedWidth, getBlockUsedWidth(frame));
    return frame;
  });
  return { blocks, height: y - top, usedWidth };
}

function materializeBlocks(
  prepared: readonly PreparedBlock[],
  frames: readonly BlockFrame[],
  width: number,
) {
  let hasCustomBlock = false;
  const blocks = prepared.map((block, index) => {
    if (block.kind === "custom") hasCustomBlock = true;
    return materializeMessageBlockLayout(block, frames[index]!, width);
  });
  return { blocks, hasCustomBlock };
}

/** Reuse the chat Markdown pipeline inside a custom block. */
export function prepareMarkdownContent(
  markdown: string,
  options: { role?: WalliChatMessageRole } = {},
) {
  const role = options.role ?? "assistant";
  const blocks = parseMarkdownBlocks(markdown, false, role);
  return {
    layout(availableWidth: number) {
      const width = Math.max(1, availableWidth);
      const frame = layoutBlocks(blocks, width);
      return {
        height: frame.height,
        width: Math.min(width, Math.max(1, frame.usedWidth)),
        render(ctx: WalliChatBlockContext, messageId: string) {
          const layouts = materializeBlocks(blocks, frame.blocks, width).blocks;
          return layouts.map((block) => renderMessageBlockTemplate(block, 0, ctx, messageId, role));
        },
      };
    },
  };
}

function getMessageGap(
  message: PreparedChatMessage | undefined,
  getBlockState?: WalliChatBlockContext["getBlockState"],
): number {
  if (message && getBlockState?.(message.id, editBlockStateKey) !== undefined) {
    return getCommonStyle("messageGap");
  }
  switch (message?.role) {
    case undefined:
    case "user":
    case "system":
      return 0;
    default:
      return getCommonStyle("messageGap");
  }
}

function layoutMessageFrame(
  preparedMessage: PreparedChatMessage,
  maxFrameWidth: number,
  maxContentWidth: number,
): MessageFrame {
  const roleBlock = resolveRoleBlockDefinition(preparedMessage.role);
  const bodyInsetX = roleBlock?.getContentInsetX?.(preparedMessage.meta ?? roleBlock.meta) ?? 0;
  const isSystem = preparedMessage.role === "system";
  const bubblePaddingY = isSystem
    ? getCommonStyle("systemBubblePaddingY")
    : getCommonStyle("bubblePaddingY");
  const paddingY = preparedMessage.role === "user" ? 0 : bubblePaddingY;
  const layout = layoutBlocks(
    preparedMessage.blocks,
    maxContentWidth,
    paddingY,
    preparedMessage.meta,
    maxFrameWidth,
  );
  const { blocks, height, usedWidth: usedContentWidth } = layout;
  const bubbleHeight = height + paddingY * 2;
  let actionHeight = 0;
  if (!preparedMessage.streaming && preparedMessage.showActions) {
    switch (preparedMessage.role) {
      case "assistant":
        actionHeight = getCommonStyle("assistantMessageActionHeight");
        break;
      case "user":
        actionHeight = getCommonStyle("userMessageActionHeight");
        break;
    }
  }
  const paddingTop = preparedMessage.role === "user" ? getCommonStyle("userMessagePaddingTop") : 0;
  const frameWidth =
    preparedMessage.role === "user"
      ? Math.min(maxFrameWidth, Math.max(1, usedContentWidth))
      : maxFrameWidth;
  const frame: MessageFrame = {
    actionHeight,
    bodyInsetX,
    blocks,
    bubbleHeight,
    contentInsetX: 0,
    frameWidth,
    layoutContentWidth: maxContentWidth,
    totalHeight: bubbleHeight + paddingTop + actionHeight,
    paddingTop,
  };
  return frame;
}

function createTimeSystemMessage(
  message: PreparedChatMessage,
  previousUserMessage: PreparedChatMessage | undefined,
  options: TimeSystemMessageOptions | undefined,
  layoutCache: MessageLayoutCache,
): PreparedChatMessage | undefined {
  if (message.role !== "user" || options === undefined) return undefined;

  const intervalMilliseconds = options.intervalSeconds * 1_000;
  if (!Number.isFinite(intervalMilliseconds) || intervalMilliseconds <= 0) return undefined;

  const { createdAt } = message;
  if (createdAt === undefined || !Number.isFinite(createdAt)) return undefined;

  const previousCreatedAt = previousUserMessage?.createdAt;
  if (previousUserMessage !== undefined && !Number.isFinite(previousCreatedAt)) return undefined;

  const elapsedMilliseconds =
    previousCreatedAt === undefined ? Date.now() - createdAt : createdAt - previousCreatedAt;
  if (elapsedMilliseconds <= intervalMilliseconds) return undefined;

  const text = options.formatter?.(createdAt) ?? formatTimeSystemMessage(createdAt);
  const id = `system-time:${message.id}`;
  const cached = layoutCache.get(id)?.prepared;
  if (cached?.markdown === text && cached.createdAt === createdAt) return cached;
  return createPreparedChatMessages([createSystemMessage(text, { createdAt, id })])[0]!;
}

export function materializeMessageBlocks(message: ChatMessageInstance): {
  blocks: BlockLayout[];
  hasCustomBlock: boolean;
} {
  return materializeBlocks(
    message.prepared.blocks,
    message.frame.blocks,
    message.frame.layoutContentWidth,
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
