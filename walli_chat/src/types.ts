import type { IconNode } from "lucide";

export type WalliChatMessage = {
  id: string;
  meta?: unknown;
  role: "assistant" | "user";
  markdown: string;
  showActions?: boolean;
};
export type WalliChatMessagePatch = Partial<Omit<WalliChatMessage, "id">>;

export type WalliChatFeedback = "like" | "dislike";
export type WalliChatFeedbackCallback = (
  id: string,
  markdown: string,
  feedback: WalliChatFeedback,
) => void;
export type WalliChatMessageCallback = (id: string, markdown: string) => void;
export type WalliChatBlockAction = {
  data: unknown;
  messageId: string;
  name: string;
};
export type WalliChatBlockActionCallback = (
  action: WalliChatBlockAction,
) => void | PromiseLike<void>;
export type WalliChatRemoveMessages = () => void;
export type WalliChatEndReachedInfo = {
  distanceFromEnd: number;
};
export type WalliChatEndReachedCallback = (
  info: WalliChatEndReachedInfo,
) => void | PromiseLike<void>;
export type WalliChatInsertMessagesOptions = {
  stick?: boolean;
};

export type WalliChatComposerSubmitCallback = (
  markdown: string,
  text: string,
  assets: readonly WalliChatComposerAsset[],
) => void | Promise<void>;
export type WalliChatComposerAsset = {
  file: File;
  type: "file" | "image";
  url: string;
};
export type WalliChatComposerInsertAsset = Omit<WalliChatComposerAsset, "url"> & {
  url?: string;
};
export type WalliChatComposerUploadResult =
  { url: string; error?: never } | { error: Error; url?: never };
export type WalliChatComposerValueCallback = (value: string) => void;
export type WalliChatComposerActionCallback = () => void;
export type WalliChatComposerTranscriptionResult = {
  audio: Blob;
};
export type WalliChatComposerTranscriptionContext = {
  finished: Promise<WalliChatComposerTranscriptionResult>;
  signal: AbortSignal;
  stream: Promise<MediaStream>;
};
export type WalliChatComposerTranscribeCallback = (
  context: WalliChatComposerTranscriptionContext,
) => string | PromiseLike<string>;
export type WalliChatComposerRemoveImageCallback = (image: File) => void | Promise<void>;
export type WalliChatComposerSetUploadProgress = (image: File, progress: number) => void;
export type WalliChatComposerSetUploadResult = (
  image: File,
  result: WalliChatComposerUploadResult,
) => void;
export type WalliChatComposerInsertedAssetsHandle = {
  setProgress: WalliChatComposerSetUploadProgress;
  setResult: WalliChatComposerSetUploadResult;
};
export type WalliChatComposerUploadImagesCallback = (
  images: readonly File[],
  setProgress: WalliChatComposerSetUploadProgress,
  setResult: WalliChatComposerSetUploadResult,
) =>
  | void
  | WalliChatComposerRemoveImageCallback
  | Promise<void | WalliChatComposerRemoveImageCallback>;
export type WalliChatComposerMenuItem = {
  icon: IconNode;
  onClick: WalliChatComposerActionCallback;
  title: string;
};

/** A Vercel AI SDK UI Message Stream (SSE), or a promise for one. */
export type WalliChatTextStream =
  ReadableStream<string | Uint8Array> | PromiseLike<ReadableStream<string | Uint8Array>>;

export type WalliChatStreamingOptions = {
  getToolLabel?: (toolName: string) => string;
  messageId: string;
  reasoningLabels?: {
    thinking?: string;
    thought?: string;
  };
  stickToBottom?: boolean;
};

export type WalliChatStreamingHandle = {
  abort: (reason?: unknown) => void;
  finished: Promise<void>;
  signal: AbortSignal;
};

export type WalliChatScrollTarget = "top" | "bottom";

export type WalliChatScrollToOptions = {
  animated?: boolean;
  target?: WalliChatScrollTarget;
  top?: number;
};

export type WalliChatScrollToIndexOptions = {
  animated?: boolean;
  index: number;
};
