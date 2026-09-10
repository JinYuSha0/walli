---
name: walli-chat
description: Build chat interfaces with @wallilabs/chat in vanilla JavaScript, React, or Vue. Use for messages, streaming, composer uploads, actions, scrolling, and custom blocks in this package.
---

# Walli Chat

Use the installed version of `@wallilabs/chat` and its public entry points. This package supplies chat UI; the application owns requests, persistence, uploads, and model credentials.

For package setup or skill installation, read [installation](references/installation.md).

Read [shared API](references/api.md), then only the relevant framework guide:

- [Vanilla JavaScript](references/javascript.md): DOM properties and custom elements.
- [React](references/react.md): controlled props and forwarded refs; React >=18.
- [Vue](references/vue.md): callback props, v-model and exposed methods; Vue >=3.4.
- [Existing custom blocks](references/existing-blocks.md): recommended replies, confirmation cards, notices, and people messages from `@wallilabs/chat-blocks`.
- [Custom blocks](references/blocks.md): read when extending Markdown or message rendering.

Import `@wallilabs/chat/theme.css` once and give the chat a bounded height. For SSR applications, mount the browser components in a client-only boundary.

Use unique message IDs and immutable message arrays. Choose a consistent owner for messages: declarative framework state or imperative element methods. Imperative inserts/streams do not update React/Vue state; sending an old messages array back can erase them. Synchronize from `ref.element.messages` before the next declarative update when combining these approaches.

Streaming accepts Vercel AI SDK UI Message Stream SSE, not raw text chunks or OpenAI chat-completion JSON. Always provide `messageId`, handle `finished`, and wire cancellation when needed. The composer callback's promise controls its busy state; await streaming completion inside `onSubmit` if it should remain busy.

For exact overloads or less common exports, inspect the installed `dist/types/index.d.ts`, `dist/types/types.d.ts`, `dist/types/web-components/`, and the chosen `dist/types/react/index.d.ts` or `dist/types/vue/index.d.ts`. Do not import private `src` or `dist` modules in application code. Verify the target app builds and exercise the affected interaction (submission, cancellation, history, or upload).
