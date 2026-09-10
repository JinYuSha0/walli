# @wallilabs/chat

High-performance AI chat Web Components with React and Vue wrappers.

## Storybook

- **Vanilla:** [https://storybook.wallibot.dev](https://storybook.wallibot.dev)
- **React:** [https://storybook-react.wallibot.dev](https://storybook-react.wallibot.dev)
- **Vue:** [https://storybook-vue.wallibot.dev](https://storybook-vue.wallibot.dev)

## Install

```bash
npm install @wallilabs/chat
```

## Agent skill and API reference

The npm package includes [the Walli Chat skill](./skills/walli-chat/SKILL.md), with
[installation](./skills/walli-chat/references/installation.md),
[existing custom blocks](./skills/walli-chat/references/existing-blocks.md),
[shared API](./skills/walli-chat/references/api.md),
[JavaScript](./skills/walli-chat/references/javascript.md),
[React](./skills/walli-chat/references/react.md),
[Vue](./skills/walli-chat/references/vue.md), and
[custom blocks](./skills/walli-chat/references/blocks.md) guides.

`npm install @wallilabs/chat` automatically links the bundled skill into
`.agents/skills/walli-chat` through the package's `postinstall` script. No separate
skill command is needed when dependency lifecycle scripts are enabled.

The link follows dependency upgrades. Existing different skills are preserved;
link failures do not fail installation of the UI library. Global installs and
source-repository installs without a consuming project are skipped.

Codex can discover `$walli-chat` through this directory. If it does not appear,
restart Codex. See [Codex skill discovery](https://learn.chatgpt.com/docs/build-skills).

Package managers can block dependency scripts (including pnpm configurations),
and `--ignore-scripts` disables this automatic step. The package cannot override
that policy. The skill files are still included under
`node_modules/@wallilabs/chat/skills/walli-chat`; if needed, the optional repair
command is `npx --no-install walli-chat-skill` from the consuming project.
See [npm lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/) and
[pnpm script settings](https://pnpm.io/settings).

Tools can resolve the bundled entry without importing browser code:

```js
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const skillPath = require.resolve("@wallilabs/chat/skills/walli-chat/SKILL.md");
```

## Vanilla

```ts
import "@wallilabs/chat";
import "@wallilabs/chat/theme.css";
import type { WalliChatComposerElement, WalliChatElement, WalliChatMessage } from "@wallilabs/chat";

const chat = document.querySelector<WalliChatElement>("walli-chat")!;
const composer = document.querySelector<WalliChatComposerElement>("walli-chat-composer")!;

const messages: WalliChatMessage[] = [
  { id: "welcome", role: "assistant", markdown: "Hello! How can I help?" },
];

chat.messages = messages;
composer.onSubmit = async (markdown) => {
  chat.messages = [...chat.messages, { id: crypto.randomUUID(), role: "user", markdown }];
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
import { WalliChat, WalliChatComposer, type WalliChatMessage } from "@wallilabs/chat/react";
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
import { WalliChat, WalliChatComposer, type WalliChatMessage } from "@wallilabs/chat/vue";
import "@wallilabs/chat/theme.css";

const value = ref("");
const messages = ref<WalliChatMessage[]>([
  { id: "welcome", role: "assistant", markdown: "Hello! How can I help?" },
]);

function handleSubmit(markdown: string) {
  messages.value = [...messages.value, { id: crypto.randomUUID(), role: "user", markdown }];
  value.value = "";
}
</script>

<template>
  <WalliChat :messages="messages" style="height: 640px">
    <WalliChatComposer v-model:value="value" slot="composer" :on-submit="handleSubmit" />
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

## Blocks by message role

`registerBlock` accepts an optional `role`: `assistant`, `system`, `user`, or any custom name. A role-specific registration takes precedence over the same block's shared registration (without `role`). Custom message roles keep their original role and use the default left-aligned layout. Built-in action buttons apply only to assistant/user messages; slide-in insertion animations apply only to assistant messages.

```ts
import { registerBlock, type WalliChatElement } from "@wallilabs/chat";
import { noticeBlockDefinition, createNoticeMarkdown } from "@wallilabs/chat-blocks";

registerBlock(noticeBlockDefinition);
const registration = registerBlock({
  ...noticeBlockDefinition,
  role: "tool",
  render(context) {
    // context.role contains the actual message role.
    return noticeBlockDefinition.render(context);
  },
});

const chat = document.querySelector<WalliChatElement>("walli-chat")!;
chat.messages = [
  {
    id: "tool-result",
    role: "tool",
    markdown: createNoticeMarkdown({ text: "Tool finished", variant: "success" }),
  },
];

// Call registration.unregister() when this override is no longer needed.
```

Register blocks before assigning messages. Tokenization, preparation, measurement, and rendering use the matching role registration; measurement, materialization, and render contexts expose the actual `role`. Unregistering restores the previous registration or shared fallback for subsequent parsing. Built-in blocks are registered internally through the same `registerBlock` API and support role-specific overrides too.

Streaming insertion accepts `role` in its options, for example `chat.insertStreamingMessageAtBottom(stream, { role: "tool" })`. The default remains `assistant`. The same registration API and message types are available from the React and Vue entry points.

### Default system block

`systemBlockDefinition` is the default `{ name: "inline", role: "system" }` registration. It owns the system text style and uses the same preparation, measurement, and rendering pipeline as other blocks. It is exported from the main, React, and Vue entry points.

```ts
import { registerBlock, systemBlockDefinition } from "@wallilabs/chat";
import { html } from "lit";

registerBlock({
  ...systemBlockDefinition,
  render(context) {
    return html`<div class="my-system-message">${systemBlockDefinition.render(context)}</div>`;
  },
});
```

Defaults are registered centrally in `core/blocks/index.ts` through `registerBlock`. Register application overrides after importing the library and before assigning messages. Later registrations override earlier ones for the same name and role; `unregister()` restores the previous definition. The message container still controls system alignment and link actions.
