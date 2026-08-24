import { generateText, Output, type LanguageModel, type ModelMessage } from "ai";
import { Tiktoken } from "js-tiktoken/lite";
import o200kBase from "js-tiktoken/ranks/o200k_base";
import { z } from "zod";
import type { ModelCapabilityTag, ModelConfig } from "@shared/const";

const TOKEN_MESSAGE_OVERHEAD = 4;
let tokenizer: Tiktoken | undefined;
const markdownImagePattern =
  /!\[([^\]]*)\]\(\s*(?:<(https?:\/\/[^>]+)>|(https?:\/\/[^\s)]+))\s*\)(?:\{[^}]*\})?/gi;
const privateImagePathPattern = /^\/api\/assets\/([^/]+)\/image\/([^/]+)$/;
const temporaryAssetPathPattern = /^\/api\/assets\/[^/]+\/(?:image|file)\/[^/]+$/;
const TEMPORARY_ASSET_URL_TTL_MS = 5 * 60 * 1000;
const MODEL_IMAGE_MAX_COUNT = 4;
const MODEL_IMAGE_MAX_SIZE = 1536;
const MODEL_IMAGE_QUALITY = 80;

type ModelAssetContext = {
  bucket: R2Bucket;
  createHistoricalReferenceResolver?: () => HistoricalAssetReferenceResolver;
  images: ImagesBinding;
  origin: string;
  userId?: string;
};

type HistoricalAssetReferenceResolver = (input: {
  candidates: Array<{ assetMessage: string; messageIndex: number }>;
  conversation: Array<{ content: string; messageIndex: number; role: string }>;
  latestUserMessage: string;
}) => Promise<number[]>;

export const modelSupportsCapability = (
  models: ModelConfig[],
  modelName: string,
  capability: ModelCapabilityTag,
) => models.some((model) => model.name === modelName && model.tags.includes(capability));

const historicalAssetReferenceSchema = z.object({
  selectedMessageIndexes: z.array(z.number().int().nonnegative()),
});

export const createHistoricalAssetReferenceResolver = (
  model: LanguageModel,
): HistoricalAssetReferenceResolver =>
  async ({ candidates, conversation, latestUserMessage }) => {
    const result = await generateText({
      model,
      instructions: [
        "Select every historical image message whose original images must be inspected to answer the latest user message accurately.",
        "Use the full conversation to resolve references such as the first image, the previous two images, a person, an object, or an implicit visual follow-up.",
        "Return only messageIndex values present in candidates. Return an empty array when prior text answers are sufficient or the request is unrelated to all images.",
        'Return JSON only with this shape: {"selectedMessageIndexes":[0]}.',
      ].join("\n"),
      prompt: JSON.stringify({
        imageCandidates: candidates,
        conversation,
        latestUserMessage,
      }),
      output: Output.object({
        schema: historicalAssetReferenceSchema,
        name: "historical_asset_reference",
        description: "Historical image message indexes that must be loaded for this response.",
      }),
    });

    const candidateIndexes = new Set(candidates.map(({ messageIndex }) => messageIndex));
    return [...new Set(result.output.selectedMessageIndexes)].filter((index) =>
      candidateIndexes.has(index));
  };

export async function createTemporaryAssetUrl(
  value: string,
  origin: string,
  secret: string,
): Promise<string> {
  const url = new URL(value);
  if (url.origin !== origin || !temporaryAssetPathPattern.test(url.pathname)) return value;

  const expires = String(Date.now() + TEMPORARY_ASSET_URL_TTL_MS);
  url.searchParams.set("expires", expires);
  url.searchParams.set("signature", await createAssetSignature(secret, url.pathname, expires));
  return url.toString();
}

export async function hasValidTemporaryAssetUrl(
  secret: string,
  path: string,
  expires: string | undefined,
  signature: string | undefined,
): Promise<boolean> {
  if (
    !secret.trim()
    || !temporaryAssetPathPattern.test(path)
    || !expires
    || !signature
    || !/^\d+$/.test(expires)
    || Number(expires) < Date.now()
    || !/^[a-f\d]{64}$/.test(signature)
  ) {
    return false;
  }

  const signatureBytes = Uint8Array.from(signature.match(/.{2}/g)!, (value) =>
    Number.parseInt(value, 16));
  return crypto.subtle.verify(
    "HMAC",
    await createAssetSigningKey(secret),
    signatureBytes,
    new TextEncoder().encode(`${path}.${expires}`),
  );
}

async function createAssetSignature(
  secret: string,
  path: string,
  expires: string,
): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await createAssetSigningKey(secret),
    new TextEncoder().encode(`${path}.${expires}`),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createAssetSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

export const createImageAttachmentInstructions = (messages: ModelMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    if (typeof message.content !== "string" || !/!\[[^\]]*\]\([^)]+\)/.test(message.content)) {
      return undefined;
    }

    return [
      "The latest user message contains one or more image attachments.",
      "You must call image_to_text with all attached image URLs before answering, even when the user does not explicitly ask to analyze the images.",
      "Use the text accompanying the images as the image_to_text prompt so the analysis follows the user's actual request and context.",
      "Answer the user using the tool result. Do not claim that you cannot access the images before calling the tool.",
    ].join("\n");
  }

  return undefined;
};

export const prepareModelMessagesWithAssets = async (
  messages: ModelMessage[],
  context: ModelAssetContext,
): Promise<ModelMessage[]> => {
  const imageMessageIndexes = new Set<number>();
  const latestUserMessage = findLatestUserMessage(messages);

  if (latestUserMessage && hasMarkdownImage(latestUserMessage.content)) {
    imageMessageIndexes.add(latestUserMessage.index);
  } else if (latestUserMessage && context.createHistoricalReferenceResolver) {
    const candidates = messages
      .slice(0, latestUserMessage.index)
      .flatMap((message, messageIndex) =>
        message.role === "user"
        && typeof message.content === "string"
        && hasMarkdownImage(message.content)
          ? [{ assetMessage: message.content, messageIndex }]
          : []);
    if (candidates.length > 0) {
      const selectedIndexes = await context.createHistoricalReferenceResolver()({
        candidates,
        conversation: messages
          .slice(0, latestUserMessage.index + 1)
          .flatMap((message, messageIndex) =>
            typeof message.content === "string"
              ? [{ content: message.content, messageIndex, role: message.role }]
              : []),
        latestUserMessage: latestUserMessage.content,
      });
      for (const index of selectedIndexes) imageMessageIndexes.add(index);
    }
  }

  let remainingImageCount = MODEL_IMAGE_MAX_COUNT;
  return Promise.all(
    messages.map(async (message, index) => {
      if (message.role !== "user" || typeof message.content !== "string") return message;

      const imageUrls: string[] = [];
      const text = message.content
        .replace(
          markdownImagePattern,
          (_match, alt: string, angleUrl: string, plainUrl: string) => {
            imageUrls.push(angleUrl || plainUrl);
            return alt ? `[Image: ${alt}]` : "[Image]";
          },
        )
        .trim();
      if (imageUrls.length === 0) return message;

      if (!imageMessageIndexes.has(index)) {
        return { ...message, content: text };
      }

      const includedImageUrls = imageUrls.slice(0, remainingImageCount);
      remainingImageCount -= includedImageUrls.length;
      const imageParts = await Promise.all(
        includedImageUrls.map((url) => createModelImagePart(url, context)),
      );
      return {
        ...message,
        content: [
          { type: "text" as const, text: text || "Please respond to the attached image." },
          ...imageParts,
        ],
      };
    }),
  );
};

export const hasImageMessages = (messages: ModelMessage[]): boolean =>
  messages.some(
    (message) =>
      message.role === "user"
      && typeof message.content === "string"
      && hasMarkdownImage(message.content),
  );

export const hasHistoricalImageMessages = (messages: ModelMessage[]): boolean => {
  const latestUserMessage = findLatestUserMessage(messages);

  return latestUserMessage
    ? hasImageMessages(messages.slice(0, latestUserMessage.index))
    : false;
};

function hasMarkdownImage(content: string): boolean {
  markdownImagePattern.lastIndex = 0;
  return markdownImagePattern.test(content);
}

function findLatestUserMessage(
  messages: ModelMessage[],
): { content: string; index: number } | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === "user" && typeof message.content === "string") {
      return { content: message.content, index };
    }
  }
  return undefined;
}

async function createModelImagePart(value: string, context: ModelAssetContext) {
  const url = new URL(value);
  const privatePath =
    url.origin === context.origin ? privateImagePathPattern.exec(url.pathname) : null;
  if (!privatePath) return { type: "image" as const, image: url };

  const ownerId = decodeURIComponent(privatePath[1]!);
  const imageId = decodeURIComponent(privatePath[2]!);
  if (!context.userId || ownerId !== context.userId) {
    throw new Error("Private image is not owned by the current user");
  }

  const object = await context.bucket.get(`uploads/${ownerId}/images/${imageId}`);
  if (!object || object.customMetadata?.userId !== ownerId) {
    throw new Error("Private image not found");
  }

  const mediaType = object.httpMetadata?.contentType;
  if (!mediaType?.startsWith("image/")) throw new Error("Private asset is not an image");

  const transformed = await context.images
    .input(object.body)
    .transform({
      fit: "scale-down",
      height: MODEL_IMAGE_MAX_SIZE,
      width: MODEL_IMAGE_MAX_SIZE,
    })
    .output({ anim: false, format: "image/webp", quality: MODEL_IMAGE_QUALITY });
  const response = transformed.response();
  if (!response.ok) throw new Error("Private image optimization failed");

  return {
    type: "image" as const,
    image: await response.arrayBuffer(),
    mediaType: "image/webp",
  };
}

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

const getTokenizer = () => {
  tokenizer ??= new Tiktoken(o200kBase);
  return tokenizer;
};

const countTextTokens = (text: string): number => getTokenizer().encode(text).length;

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
