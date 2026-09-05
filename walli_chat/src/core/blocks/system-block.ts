import type { WalliChatMessage } from "../../types";

export function createSystemMessage(
  markdown: string,
  options: { createdAt?: number; id?: string } = {},
): WalliChatMessage {
  return {
    createdAt: options.createdAt,
    id: options.id ?? `system-${crypto.randomUUID()}`,
    markdown,
    role: "system",
    showActions: false,
  };
}
