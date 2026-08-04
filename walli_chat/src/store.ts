import { computed, signal } from "@preact/signals-core";
import { getMessages, type MarkdownChatSeed } from "./mock/data1";

export const messages = signal<MarkdownChatSeed[]>(getMessages());

export const messagesCount = computed(() => messages.value.length);
