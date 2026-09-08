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

## Responsive breakpoint

Set `responsive` to select the shared global breakpoint. Supported values:
`base`, `sm`, `md`, `lg`, `xl`, `2xl`. Without an override, viewport media queries apply.

```html
<walli-chat responsive="xl"></walli-chat>
```

All chats share this setting. Changing `responsive` updates the global breakpoint
and relayouts that chat. Removing the attribute restores automatic viewport detection.
Other chats use the new global setting on their next layout; there is no global subscription.

## Insert incoming messages

```ts
const remove = chat.insertMessagesAtBottom(incomingMessages, {
  waitForStreaming: true,
  animation: "slide-in",
  stick: true,
});
```

Both insertion methods accept these optional settings. `waitForStreaming` queues
messages until all active streams finish, abort, or fail. Batches are processed in
arrival order. Calling the returned `remove()` before insertion cancels that batch.
`animation: "slide-in"` slides assistant messages in from the left on their first
visible render only, including messages first revealed by scrolling. It respects
reduced-motion preferences. Without these options, insertion is immediate with no animation.

## License

[MIT](./LICENSE) © 2026 JinYuSha0
