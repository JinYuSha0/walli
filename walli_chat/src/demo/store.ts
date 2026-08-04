import { computed, signal } from "@preact/signals-core";
import { getMessages, type MarkdownChatSeed } from "../mock/data1";

export const messages = signal<MarkdownChatSeed[]>(getMessages());

export const messagesCount = computed(() => messages.value.length);

if (import.meta.hot) {
  import.meta.hot.accept("../mock/data1", (module) => {
    if (!module) return;

    messages.value = module.getMessages();
  });
}
