# @wallilabs/chat

High-performance AI chat Web Components with React and Vue wrappers.

## Install

```bash
npm install @wallilabs/chat
```

## Web Components

```ts
import "@wallilabs/chat";
import "@wallilabs/chat/theme.css";
```

```html
<walli-chat style="display:block;height:640px">
  <walli-chat-composer slot="composer" placeholder="Message Walli"></walli-chat-composer>
</walli-chat>
```

```ts
import type { WalliChatElement } from "@wallilabs/chat";

const chat = document.querySelector<WalliChatElement>("walli-chat");
if (chat) {
  chat.messages = [
    {
      id: "welcome",
      role: "assistant",
      markdown: "Hello! How can I help?",
    },
  ];
}
```

## React

```ts
import { WalliChat, WalliChatComposer } from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";
```

## Vue

```ts
import { WalliChat, WalliChatComposer } from "@wallilabs/chat/vue";
import "@wallilabs/chat/theme.css";
```

Custom blocks are available from [`@wallilabs/chat-blocks`](https://www.npmjs.com/package/@wallilabs/chat-blocks).
