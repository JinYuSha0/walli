import type { ModelMessage } from "ai";
import { Tiktoken } from "js-tiktoken/lite";
import o200kBase from "js-tiktoken/ranks/o200k_base";

const TOKEN_MESSAGE_OVERHEAD = 4;
const tokenizer = new Tiktoken(o200kBase);

const getToolCallIds = (message: ModelMessage): string[] => {
  if (message.role !== "assistant" || typeof message.content === "string") {
    return [];
  }

  return message.content.filter((part) => part.type === "tool-call").map((part) => part.toolCallId);
};

const getToolResultIds = (message: ModelMessage): string[] => {
  if (message.role !== "tool") {
    return [];
  }

  return message.content
    .filter((part) => part.type === "tool-result")
    .map((part) => part.toolCallId);
};

const removeToolCallParts = (message: ModelMessage): ModelMessage | undefined => {
  if (message.role !== "assistant" || typeof message.content === "string") {
    return message;
  }

  const content = message.content.filter((part) => part.type !== "tool-call");

  if (content.length === 0) {
    return undefined;
  }

  return {
    ...message,
    content,
  };
};

export const sanitizeModelMessageHistory = (messages: ModelMessage[]): ModelMessage[] => {
  const sanitized: ModelMessage[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message.role === "tool") {
      continue;
    }

    const toolCallIds = getToolCallIds(message);

    if (toolCallIds.length === 0) {
      sanitized.push(message);
      continue;
    }

    const nextMessage = messages[index + 1];
    const toolResultIds = nextMessage ? getToolResultIds(nextMessage) : [];
    const hasCompleteToolResults =
      nextMessage?.role === "tool" &&
      toolCallIds.length > 0 &&
      toolCallIds.every((toolCallId) => toolResultIds.includes(toolCallId));

    if (!hasCompleteToolResults) {
      const messageWithoutToolCalls = removeToolCallParts(message);

      if (messageWithoutToolCalls) {
        sanitized.push(messageWithoutToolCalls);
      }

      continue;
    }

    sanitized.push(message, nextMessage);
    index += 1;
  }

  return sanitized;
};

const stringifyForTokenCount = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
};

const countTextTokens = (text: string): number => tokenizer.encode(text).length;

const countModelMessageTokens = (message: ModelMessage): number => {
  if (typeof message.content === "string") {
    return TOKEN_MESSAGE_OVERHEAD + countTextTokens(message.content);
  }

  return (
    TOKEN_MESSAGE_OVERHEAD +
    message.content.reduce((total, part) => total + countTextTokens(stringifyForTokenCount(part)), 0)
  );
};

const countModelMessagesTokens = (messages: ModelMessage[]): number =>
  messages.reduce((total, message) => total + countModelMessageTokens(message), 0);

export const limitModelMessagesByTokens = (
  messages: ModelMessage[],
  maxInputTokens: number | undefined,
  preserveTrailingMessages = 1,
): { messages: ModelMessage[]; tokenCount: number } => {
  if (maxInputTokens === undefined || maxInputTokens <= 0) {
    return {
      messages,
      tokenCount: countModelMessagesTokens(messages),
    };
  }

  const trailingCount = Math.max(0, Math.trunc(preserveTrailingMessages));
  const trailingMessages = trailingCount === 0 ? [] : messages.slice(-trailingCount);
  const trailingTokens = countModelMessagesTokens(trailingMessages);

  if (trailingTokens > maxInputTokens) {
    return {
      messages: trailingMessages,
      tokenCount: trailingTokens,
    };
  }

  const leadingMessages = trailingCount === 0 ? messages : messages.slice(0, -trailingCount);
  const keptLeadingMessages: ModelMessage[] = [];
  let remainingTokens = maxInputTokens - trailingTokens;

  for (let index = leadingMessages.length - 1; index >= 0; index -= 1) {
    const message = leadingMessages[index];
    const tokenCount = countModelMessageTokens(message);

    if (tokenCount > remainingTokens) {
      continue;
    }

    keptLeadingMessages.unshift(message);
    remainingTokens -= tokenCount;
  }

  return {
    messages: [...keptLeadingMessages, ...trailingMessages],
    tokenCount: maxInputTokens - remainingTokens,
  };
};
