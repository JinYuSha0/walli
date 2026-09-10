# React

```tsx
import { useRef, useState } from "react";
import {
  WalliChat,
  WalliChatComposer,
  type WalliChatMessage,
  type WalliChatRef,
} from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";

export function Chat() {
  const chat = useRef<WalliChatRef>(null);
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<WalliChatMessage[]>([]);
  return (
    <WalliChat
      ref={chat}
      messages={messages}
      style={{ height: 640 }}
      emptyContent={<p>Start a conversation</p>}
    >
      <WalliChatComposer
        slot="composer"
        value={value}
        onValueChange={setValue}
        onSubmit={async (markdown) => {
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "user",
              markdown,
            },
          ]);
          setValue("");
        }}
      />
    </WalliChat>
  );
}
```

`WalliChatProps` requires `messages`; `WalliChatComposerProps` requires `value`. Shared API properties use camelCase. Additional chat props: `children`, `className`, `style`, `emptyContent`; composer also accepts `className`, `style`, `slot`.

`WalliChatRef` exposes shared chat methods and `.element`; `WalliChatComposerRef` exposes `.element`, `focus`, `insertAssets`. Call refs after mount; streaming before mount throws. For operations absent from the wrapper use the public element API, e.g. `composerRef.current?.element?.submitMessage('Hello')`.

For imperative streaming, keep the `messages` prop stable while the element owns updates; synchronize `setMessages([...chat.current.element.messages])` before resuming declarative ownership. Do not append a stream and then overwrite it with stale state. Abort active requests/handles during unmount.

`WalliLoading` accepts `ariaLabel`, `className`, `style`, with a forwarded DOM ref. Wrappers perform custom-element registration automatically. In server-rendered apps, use the framework's client-only mounting mechanism for this browser UI.
