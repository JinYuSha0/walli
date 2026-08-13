export type WalliChatMessage = {
  role: "assistant" | "user";
  markdown: string;
};

export type WalliChatTextStream = ReadableStream<string | Uint8Array>;

export type WalliChatStreamingOptions = {
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
