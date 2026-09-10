# Vue 3

```vue
<script setup lang="ts">
import { ref } from "vue";
import {
  WalliChat,
  WalliChatComposer,
  type WalliChatMessage,
  type WalliChatExpose,
} from "@wallilabs/chat/vue";
import "@wallilabs/chat/theme.css";

const chat = ref<WalliChatExpose | null>(null);
const value = ref("");
const messages = ref<WalliChatMessage[]>([]);
async function submit(markdown: string) {
  messages.value = [
    ...messages.value,
    {
      id: crypto.randomUUID(),
      role: "user",
      markdown,
    },
  ];
  value.value = "";
}
</script>

<template>
  <WalliChat ref="chat" :messages="messages" :style="{ height: '640px' }">
    <template #empty><p>Start a conversation</p></template>
    <WalliChatComposer slot="composer" v-model:value="value" :on-submit="submit" />
  </WalliChat>
</template>
```

Use imported wrappers; no compiler `isCustomElement` configuration is needed for them. The composer's `slot="composer"` is a native DOM slot attribute, not `<template #composer>`.

Shared API props use kebab-case in templates (`:default-scroll-to-bottom`, `:on-end-reached`, `:action-config`). Composer callbacks are function props: `:on-submit`, `:on-cancel`, `:on-upload-images`, `:on-transcribe`. Its emitted events are `update:value` and `valueChange`; bind with `v-model:value` or `@value-change`.

Chat accepts `onAction` and also emits `action`; prefer `:on-action="handleAction"` when the callback must be awaited. Do not bind both callback and event for the same handler. Chat defaults messages to an empty array; composer defaults value to an empty string. Use `class` and object `style` props.

`WalliChatExpose` has shared chat methods and `.element`; `WalliChatComposerExpose` has `.element`, `focus`, `insertAssets`. Access via `chat.value` after mount. No automatic `update:messages` event exists. If methods/streams own messages, keep the input array stable and synchronize from `chat.value.element.messages` before replacing it. Abort streams and requests in `onBeforeUnmount`.

`WalliLoading` accepts `ariaLabel`, `class`, `style` and exposes `.element`. In SSR apps, mount the browser wrappers in a client-only boundary.
