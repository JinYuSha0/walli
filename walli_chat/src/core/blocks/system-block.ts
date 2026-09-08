import type { WalliChatMessage } from "../../types";
import type { WalliChatBlockDefinition } from "../block-registry";
import { inlineBlockDefinition } from "./inline-block";

export const systemBlockDefinition = {
  ...inlineBlockDefinition,
  role: "system",
  prepare(tokens, _variant, context) {
    return inlineBlockDefinition.prepare(tokens, "system", context);
  },
} satisfies WalliChatBlockDefinition<"inline">;

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
