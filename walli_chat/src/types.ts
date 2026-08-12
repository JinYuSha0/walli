export type WalliChatMessage = {
  role: "assistant" | "user";
  markdown: string;
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
