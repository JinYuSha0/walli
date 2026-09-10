# Shared API

## Messages and chat properties

`WalliChatMessage`: required `id: string`, `role: string`, `markdown: string`; optional `createdAt: number` (milliseconds), `showActions: boolean`, `meta`. Assistant metadata supports `nickname`, `avatarUrl`, `showBubble`. Roles include assistant, user, system, and custom strings. Custom roles default to left alignment; built-in actions apply to assistant/user.

| Property              | Purpose/default                                                |
| --------------------- | -------------------------------------------------------------- |
| messages              | Readonly message array; assign a new array to update           |
| loading               | Loading state; false                                           |
| defaultScrollToBottom | Initial bottom placement; true                                 |
| defaultScrollToIndex  | Initial message index                                          |
| bottomOcclusionHeight | Bottom overlay allowance in pixels                             |
| responsive            | base, sm, md, lg, xl, 2xl; absent uses viewport                |
| onEndReached          | Callback receiving `{ distanceFromEnd }`; may return a promise |
| onEndReachedThreshold | Fraction of viewport height; 0                                 |
| onAction              | Callback receiving the action object; may return a promise     |
| actionConfig          | assistant/user action configuration                            |
| editConfig            | cancelLabel, placeholder, submitLabel                          |
| locales               | copyCode                                                       |
| timeFormatter         | `(createdAt: number) => string`                                |
| intervalSeconds       | Time separator interval; 0                                     |

`onEndReached` observes the TOP when `defaultScrollToBottom` is true, otherwise the bottom. Use it for history loading, with an application cursor/end-of-history guard. `responsive` changes a shared global breakpoint; other chats use it on their next layout.

## Chat methods

These are available on the vanilla element and React/Vue chat refs:

| Method                                          | Return / options                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| insertMessagesAtTop(messages, options?)         | Removal callback                                                         |
| insertMessagesAtBottom(messages, options?)      | Removal callback                                                         |
| replaceMessage(id, patch)                       | boolean; partial message patch                                           |
| deleteMessages(ids, options?)                   | Number deleted; optional `{ maintainHeight: true }`                      |
| insertStreamingMessageAtBottom(stream, options) | `{ abort(reason?), finished: Promise<void>, signal }`                    |
| scrollTo(options)                               | void; `{ target?: "top" \| "bottom", top?: number, animated?: boolean }` |
| scrollToIndex(options)                          | void; `{ index: number, animated?: boolean }`                            |

Insertion options: `stick?: boolean`, `waitForStreaming?: boolean`, `animation?: "slide-in" | false`. Queued batches wait for active streams to settle; calling the removal callback before insertion cancels the batch. Slide-in animates assistant messages on their first visible render and respects reduced motion.

React/Vue refs additionally expose `registerBlock` and `element`. Vanilla uses the exported `registerBlock` function. `getScrollState`, `edit`, and `submit` are action-context methods, not public chat-ref methods.

## Streaming

`stream` is a `ReadableStream<string | Uint8Array>` or promise of one, containing SSE records such as `data: {"type":"text-delta","id":"text-1","delta":"Hello"}\n\n`. The parser handles text, reasoning, tool-input/output and error events from the UI Message Stream protocol.

Required options: `messageId: string`. Optional: `role` (assistant), `getToolLabel(toolName)`, `reasoningLabels: { thinking?, thought? }`. Choose either `stickToBottom?: boolean` OR `bottomPaddingHeight: number`. Padding reserves space and positions once rather than following output.

```js
// chat is a mounted element or framework chat ref. /api/chat is app-owned.
const request = new AbortController();
const response = await fetch("/api/chat", { method: "POST", signal: request.signal });
if (!response.ok || !response.body) throw new Error("Chat request failed");
const handle = chat.insertStreamingMessageAtBottom(response.body, {
  messageId: crypto.randomUUID(),
  stickToBottom: true,
});
// Connect this to the composer onCancel callback and component cleanup.
const cancel = () => {
  handle.abort();
  request.abort();
};
await handle.finished;
```

Handle request/stream errors in application UI. Aborting a handle cancels its reader; abort the fetch controller too to cancel a request that has not returned its stream yet.

## Composer

Shared properties: `value`, `disabled=false`, `maxHeight=200`, `placeholder="Message"`, `menuItems=[]`, `transcribingText="Transcribing"`, `uploadImagesTitle="Add files"`.

- `onSubmit(markdown, text, assets) => void | Promise<void>`: Markdown includes attachments; text is trimmed input; assets contain `{ file: File, type: "file" | "image", url: string }`. Clear the input explicitly. The promise keeps the composer busy.
- `onCancel()`: application cancellation hook.
- `onValueChange(value)`: vanilla/React callback; Vue uses `v-model:value` or `@value-change`.
- `onUploadImages(files, setProgress, setResult)`: despite its name, receives files as well as images. Report progress from 0 to 100. Supply `setResult(file, { url })` or `{ error: Error }`. May return (or resolve to) a removal callback `(file) => void | Promise<void>`.
- `onTranscribe({ finished, signal, stream })`: return transcription text or a promise. `finished` resolves to `{ audio: Blob }`; `stream` resolves to a microphone `MediaStream`. The app owns transcription service integration.
- `menuItems`: `{ icon: IconNode, title: string, onClick() }[]`.

Composer refs expose `focus()` and `insertAssets([{ file, type, url? }])`. The insertion handle has `setProgress(file, progress)` and `setResult(file, result)` for externally managed uploads. Wrapper calls before mount can return undefined. The vanilla composer additionally exposes `submitMessage(text): Promise<boolean>`; wrappers access it through `.element`.

## Actions and helpers

`actionConfig.assistant` supports copy, feedback, share; `.user` supports copy, edit. Built-ins accept booleans or `{ visible, label?, sort? }`; custom action keys can specify `{ visible, label?, sort?, icon?, component? }`.

`onAction` receives `type` (copy/edit/like/dislike/share/block/custom), `messageId`, `messageType`, `markdown`, block-state accessors, and methods `deleteMessages`, `edit`, `getScrollState`, insert top/bottom, scroll, and `submit`. Icon actions also provide `setIcon`. Block actions carry `name` and `data`; `edit-block` data includes action (cancel/submit), messageIndex, messages, originalMarkdown. Use `WalliChatActionCallback<CustomActions, BlockActions>` for typed custom payloads.

`createSystemMessage(markdown, { id?, createdAt? }?)` creates a system message without actions. `prepareMarkdownContent(markdown, { role? }?)` returns prepared content with `.layout(width)` yielding dimensions and `.render(ctx, messageId)` for block authors. All three entries export these helpers plus `registerBlock`, `builtInBlocks`, `systemBlockDefinition`, `assistantBlockDefinition`, and `createAssistantBlockDefinition(role?)`. The root entry additionally exports individual built-in block definitions and `getSpace`/`getResponsiveValue`; React exports `WalliChatTrashIcon`.
