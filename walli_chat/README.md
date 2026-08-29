# @wallilabs/chat

High-performance AI chat Web Components with React and Vue wrappers.

## Storybook

- **Vanilla:** [https://storybook.wallibot.dev](https://storybook.wallibot.dev)
- **React:** [https://storybook-react.wallibot.dev](https://storybook-react.wallibot.dev)
- **Vue:** [https://storybook-vue.wallibot.dev](https://storybook-vue.wallibot.dev)

## Install

```bash
npm install @wallilabs/chat@alpha
```

## Vanilla

```ts
import "@wallilabs/chat";
import "@wallilabs/chat/theme.css";
import type {
  WalliChatComposerElement,
  WalliChatElement,
  WalliChatMessage,
} from "@wallilabs/chat";

const chat = document.querySelector<WalliChatElement>("walli-chat")!;
const composer = document.querySelector<WalliChatComposerElement>("walli-chat-composer")!;

const messages: WalliChatMessage[] = [
  { id: "welcome", role: "assistant", markdown: "Hello! How can I help?" },
];

chat.messages = messages;
composer.onSubmit = async (markdown) => {
  chat.messages = [
    ...chat.messages,
    { id: crypto.randomUUID(), role: "user", markdown },
  ];
};
```

```html
<walli-chat style="display: block; height: 640px">
  <walli-chat-composer slot="composer" placeholder="Message Walli"></walli-chat-composer>
</walli-chat>
```

## React

```tsx
import { useState } from "react";
import {
  WalliChat,
  WalliChatComposer,
  type WalliChatMessage,
} from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";

export function App() {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<WalliChatMessage[]>([
    { id: "welcome", role: "assistant", markdown: "Hello! How can I help?" },
  ]);

  return (
    <WalliChat messages={messages} style={{ height: 640 }}>
      <WalliChatComposer
        slot="composer"
        value={value}
        onValueChange={setValue}
        onSubmit={async (markdown) => {
          setMessages((current) => [
            ...current,
            { id: crypto.randomUUID(), role: "user", markdown },
          ]);
          setValue("");
        }}
      />
    </WalliChat>
  );
}
```

## Vue

```vue
<script setup lang="ts">
import { ref } from "vue";
import {
  WalliChat,
  WalliChatComposer,
  type WalliChatMessage,
} from "@wallilabs/chat/vue";
import "@wallilabs/chat/theme.css";

const value = ref("");
const messages = ref<WalliChatMessage[]>([
  { id: "welcome", role: "assistant", markdown: "Hello! How can I help?" },
]);

function handleSubmit(markdown: string) {
  messages.value = [
    ...messages.value,
    { id: crypto.randomUUID(), role: "user", markdown },
  ];
  value.value = "";
}
</script>

<template>
  <WalliChat :messages="messages" style="height: 640px">
    <WalliChatComposer
      v-model:value="value"
      slot="composer"
      :on-submit="handleSubmit"
    />
  </WalliChat>
</template>
```

Custom blocks are available from [`@wallilabs/chat-blocks`](https://www.npmjs.com/package/@wallilabs/chat-blocks).

## License

[MIT](./LICENSE) © 2026 JinYuSha0
