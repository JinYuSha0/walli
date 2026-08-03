import { computed, signal } from "@preact/signals-core";
import { BASE_MESSAGE_SPECS2, type MarkdownChatSeed } from "./mock/data2";

export const messages = signal<MarkdownChatSeed[]>(BASE_MESSAGE_SPECS2);

export const messagesCount = computed(() => messages.value.length);
