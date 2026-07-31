import { computed, signal } from "@preact/signals-core";
import { BASE_MESSAGE_SPECS } from "./mock/markdown-chat.data";
import type { ChatHistoryMessage } from "./type";

export const messages = signal<ChatHistoryMessage[]>(
  BASE_MESSAGE_SPECS.map((message, index) => ({
    id: `seed-${index}`,
    role: message.role,
    status: "done",
    parts: [
      {
        type: "text",
        text: message.markdown,
      },
    ],
  })),
);

export const messagesCount = computed(() => messages.value.length);
