export type WalliChatMessage = {
  role: "assistant" | "user";
  markdown: string;
};

export type WalliChatScrollPosition = "top" | "bottom";

export type WalliChatScrollToIndexOptions = {
  animated?: boolean;
  index?: number;
  position?: WalliChatScrollPosition;
};
