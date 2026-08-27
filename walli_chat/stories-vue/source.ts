// Storybook's bundled syntax highlighter does not register a `vue` grammar.
// Vue SFCs are HTML documents with embedded script/style blocks, so the HTML
// grammar highlights the complete example correctly.
export const source = (code: string) => ({ docs: { source: { code, language: "html" } } });

export function chatSource(messages: unknown, height = 640) {
  return `<script setup lang="ts">
import { WalliChat, type WalliChatMessage } from "@walli/chat/vue";
import "@walli/chat/theme.css";

const messages: WalliChatMessage[] = ${JSON.stringify(messages, null, 2)};
</script>

<template>
  <WalliChat :messages="messages" style="height: ${height}px" />
</template>`;
}

export function composerSource(attributes = "", initialValue = "") {
  return `<script setup lang="ts">
import { ref } from "vue";
import { WalliChatComposer } from "@walli/chat/vue";
import "@walli/chat/theme.css";

const value = ref(${JSON.stringify(initialValue)});
</script>

<template>
  <WalliChatComposer
    v-model:value="value"${attributes ? `\n    ${attributes}` : ""}
  />
</template>`;
}
