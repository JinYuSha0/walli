export type WalliChatMessage = {
  id: string;
  role: "assistant" | "user";
  markdown: string;
};

export type WalliChatFeedback = "like" | "dislike";
export type WalliChatFeedbackCallback = (
  id: string,
  markdown: string,
  feedback: WalliChatFeedback,
) => void;
export type WalliChatMessageCallback = (id: string, markdown: string) => void;

/** A UTF-8 Server-Sent Events stream containing start, delta, tool-call and tool-result events. */
export type WalliChatTextStream = ReadableStream<string | Uint8Array>;

export type WalliChatStreamingOptions = {
  getToolLabel?: (toolName: string) => string;
  messageId: string;
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
