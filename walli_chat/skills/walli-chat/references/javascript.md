# Vanilla JavaScript

Importing the root entry registers the custom elements. With a bundler:

```html
<walli-chat style="display:block;height:640px">
  <div slot="empty-content">Start a conversation</div>
  <walli-chat-composer slot="composer"></walli-chat-composer>
</walli-chat>
```

```js
import "@wallilabs/chat";
import "@wallilabs/chat/theme.css";

const chat = document.querySelector("walli-chat");
const composer = document.querySelector("walli-chat-composer");
chat.messages = [{ id: "welcome", role: "assistant", markdown: "Hello!" }];
composer.onValueChange = (value) => {
  composer.value = value;
};
composer.onSubmit = async (markdown) => {
  chat.insertMessagesAtBottom([{ id: crypto.randomUUID(), role: "user", markdown }]);
  composer.value = "";
  // Fetch and await the assistant stream here; see shared API.
};
```

Run selection after markup is mounted. Assign arrays, objects and callbacks as JavaScript properties, not string attributes. Scalar attributes include `responsive`, `loading`, `default-scroll-to-bottom`, `default-scroll-to-index`, `interval-seconds`; composer supports `disabled`, `max-height`, `placeholder`, `value`, `upload-images-title`, `transcribing-text`. Set `chat.defaultScrollToBottom = false` using a property when disabling it.

`onSubmit`, `onAction` and `onEndReached` are callback properties, not DOM event names. Use the `composer` and `empty-content` DOM slots. A standalone loading indicator is `<walli-loading aria-label="Loading"></walli-loading>`.

TypeScript consumers can import `WalliChatElement`, `WalliChatComposerElement`, and message/callback types from the root entry. Plain JavaScript needs no React or Vue dependency.
