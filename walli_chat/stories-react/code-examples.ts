import {
  assistantMessage,
  conversation,
  customBlockMessage,
  imageMessage,
  markdownShowcase,
  replaceBlockMessage,
  userMessage,
} from "../stories/ChatMessage.stories";
import { fullChatWelcomeMessages } from "./full-chat-data";

function chat(messages: unknown, height = 640): string {
  return `import { WalliChat, type WalliChatMessage } from "walli_chat/react";
import "walli_chat/theme.css";

const messages: WalliChatMessage[] = ${JSON.stringify(messages, null, 2)};

export function Example() {
  return <WalliChat messages={messages} style={{ height: ${height} }} />;
}`;
}

export const exampleSources = {
  conversation: chat(conversation),
  richMarkdown: chat(markdownShowcase),
  userMessage: chat(userMessage, 240),
  assistantMessage: chat(assistantMessage, 240),
  imageMessage: chat(imageMessage),
  customBlock: `import { useEffect, useMemo } from "react";
import { WalliChat, registerBlock } from "walli_chat/react";
import { noticeBlockDefinition } from "./notice-block";

export function Example() {
  const registration = useMemo(() => registerBlock(noticeBlockDefinition), []);
  useEffect(() => () => registration.unregister(), [registration]);

  return <WalliChat messages={${JSON.stringify(customBlockMessage, null, 2)}} />;
}`,
  replaceBlock: `import { useEffect, useRef } from "react";
import {
  WalliChat,
  registerBlock,
  type WalliChatRef,
} from "walli_chat/react";
import { replacementBlockDefinition } from "./replacement-block";

export function Example() {
  const chat = useRef<WalliChatRef>(null);

  useEffect(() => {
    const element = chat.current?.element;
    if (!element) return;

    const registration = registerBlock(replacementBlockDefinition);
    try {
      element.messages = ${JSON.stringify(replaceBlockMessage, null, 2)};
    } finally {
      registration.unregister();
    }
  }, []);

  return <WalliChat ref={chat} messages={[]} style={{ height: 320 }} />;
}`,
  themeToggle: `import { useState } from "react";
import { WalliChat } from "walli_chat/react";
import "walli_chat/theme.css";

export function Example({ messages }) {
  const [dark, setDark] = useState(false);
  return (
    <div
      className={dark ? "dark" : undefined}
      style={{ colorScheme: dark ? "dark" : "light" }}
    >
      <button onClick={() => setDark((value) => !value)}>
        {dark ? "Switch to light mode" : "Switch to dark mode"}
      </button>
      <WalliChat messages={messages} style={{ height: 480 }} />
    </div>
  );
}`,
  scrollControls: `import { useRef, useState } from "react";
import { WalliChat, type WalliChatMessage, type WalliChatRef } from "walli_chat/react";

const messages: WalliChatMessage[] = Array.from(
  { length: 40 },
  (_, index) => ({
    id: String(index),
    role: index % 2 ? "assistant" : "user",
    markdown: \`Message #\${index}\`,
  }),
);

export function Example() {
  const chat = useRef<WalliChatRef>(null);
  const [index, setIndex] = useState(20);
  return (
    <>
      <button
        onClick={() => chat.current?.scrollTo({ target: "top", animated: true })}
      >
        Top
      </button>
      <button
        onClick={() => chat.current?.scrollTo({ target: "bottom", animated: true })}
      >
        Bottom
      </button>
      <input
        type="number"
        value={index}
        onChange={(event) => setIndex(Number(event.target.value))}
      />
      <button onClick={() => chat.current?.scrollToIndex({ index, animated: true })}>
        Go
      </button>
      <WalliChat
        ref={chat}
        defaultScrollToBottom={false}
        messages={messages}
        style={{ height: 640 }}
      />
    </>
  );
}`,
  insertMessages: `import { useRef } from "react";
import { WalliChat, type WalliChatRef } from "walli_chat/react";

export function Example({ initialMessages }) {
  const chat = useRef<WalliChatRef>(null);
  return (
    <>
      <button
        onClick={() =>
          chat.current?.insertMessagesAtTop([
            { id: crypto.randomUUID(), role: "assistant", markdown: "Older message" },
          ])
        }
      >
        Insert at top
      </button>
      <button
        onClick={() =>
          chat.current?.insertMessagesAtBottom(
            [{ id: crypto.randomUUID(), role: "user", markdown: "New message" }],
            { stick: true },
          )
        }
      >
        Insert at bottom
      </button>
      <WalliChat ref={chat} messages={initialMessages} style={{ height: 640 }} />
    </>
  );
}`,
  loadOlder: pagination(true),
  loadNewer: pagination(false),
  fullChat: `import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, ImagePlus, Search } from "lucide";
import {
  WalliChat,
  WalliChatComposer,
  type WalliChatMessage,
  type WalliChatRef,
  type WalliChatStreamingHandle,
} from "walli_chat/react";
import { createStorySseStream } from "./story-stream";

const welcomeMessages: WalliChatMessage[] = ${JSON.stringify(fullChatWelcomeMessages, null, 2)};

export function FullChat() {
  const chat = useRef<WalliChatRef>(null);
  const activeStream = useRef<WalliChatStreamingHandle | undefined>(undefined);
  const [value, setValue] = useState("");
  const initialMessages = useMemo(() => welcomeMessages, []);

  return (
    <WalliChat ref={chat} messages={initialMessages} style={{ height: 720 }}>
      <WalliChatComposer
        slot="composer"
        value={value}
        onValueChange={setValue}
        menuItems={[
          {
            icon: Search,
            title: "Search the web",
            onClick: () => console.log("Search"),
          },
          {
            icon: ImagePlus,
            title: "Insert image",
            onClick: () => console.log("Image"),
          },
          {
            icon: FileSpreadsheet,
            title: "Insert spreadsheet",
            onClick: () => console.log("Spreadsheet"),
          },
        ]}
        onCancel={() => activeStream.current?.abort()}
        onSubmit={async (markdown) => {
          if (!chat.current || !markdown) return;

          chat.current.insertMessagesAtBottom(
            [{ id: crypto.randomUUID(), role: "user", markdown }],
            { stick: true },
          );
          setValue("");

          activeStream.current = chat.current.insertStreamingMessageAtBottom(
            createStorySseStream(),
            {
              messageId: crypto.randomUUID(),
              stickToBottom: true,
            },
          );
          await activeStream.current.finished;
        }}
      />
    </WalliChat>
  );
}`,
  composerAllFeatures: `import { useState } from "react";
import { FileSpreadsheet, ImagePlus, Paperclip, Search } from "lucide";
import { WalliChatComposer } from "walli_chat/react";

const menuItems = [
  { icon: Paperclip, title: "Add files", onClick: () => console.log("Add files") },
  { icon: Search, title: "Search the web", onClick: () => console.log("Search") },
  { icon: ImagePlus, title: "Insert image", onClick: () => console.log("Image") },
  { icon: FileSpreadsheet, title: "Insert spreadsheet", onClick: () => console.log("Spreadsheet") },
];

export function Example() {
  const [value, setValue] = useState("");
  return <WalliChatComposer
    value={value}
    onValueChange={setValue}
    uploadImagesTitle={menuItems[0].title}
    menuItems={menuItems.slice(1)}
    onUploadImages={async (files, setProgress, setResult) => {
      for (const file of files) {
        setProgress(file, 100);
        setResult(file, { url: URL.createObjectURL(file) });
      }
    }}
    onTranscribe={async ({ stream, finished }) => {
      await stream;
      const { audio } = await finished;
      console.log("Recorded bytes", audio.size);
      return "Transcribed message";
    }}
    onSubmit={(markdown, text, assets) => console.log({ markdown, text, assets })}
  />;
}`,
  composerDraft: composer(``, `Can you summarize this conversation?`),
  composerDisabled: composer(`disabled`),
  composerTranscription: composer(`transcribingText="Transcribing"
    onTranscribe={async ({ stream, finished }) => {
      await stream;
      const { audio } = await finished;
      console.log("Recorded bytes", audio.size);
      return "Transcribed message";
    }}`),
  composerActionMenu: `import { useState } from "react";
import { FileSpreadsheet, ImagePlus, Paperclip, Search } from "lucide";
import { WalliChatComposer } from "walli_chat/react";

const menuItems = [
  { icon: Paperclip, title: "Add files", onClick: () => console.log("Add files") },
  { icon: Search, title: "Search the web", onClick: () => console.log("Search") },
  { icon: ImagePlus, title: "Insert image", onClick: () => console.log("Image") },
  { icon: FileSpreadsheet, title: "Insert spreadsheet", onClick: () => console.log("Spreadsheet") },
];

export function Example() {
  const [value, setValue] = useState("");
  return (
    <WalliChatComposer
      value={value}
      onValueChange={setValue}
      menuItems={menuItems}
    />
  );
}`,
  composerAttachments: `import { useEffect, useRef, useState } from "react";
import { WalliChatComposer, type WalliChatComposerRef } from "walli_chat/react";

export function Example({ image, spreadsheet }) {
  const composer = useRef<WalliChatComposerRef>(null);
  const [value, setValue] = useState("");
  useEffect(() => {
    const upload = composer.current?.insertAssets([
      { file: image, type: "image" },
      { file: spreadsheet, type: "file" },
    ]);
    upload?.setProgress(image, 50);
    upload?.setResult(image, { url: URL.createObjectURL(image) });
  }, [image, spreadsheet]);
  return (
    <WalliChatComposer
      ref={composer}
      value={value}
      onValueChange={setValue}
    />
  );
}`,
} as const;

function pagination(loadAtTop: boolean): string {
  const method = loadAtTop ? "insertMessagesAtTop" : "insertMessagesAtBottom";
  return `import { useRef } from "react";
import { WalliChat, type WalliChatRef } from "walli_chat/react";

export function Example({ initialPage, loadNextPage }) {
  const chat = useRef<WalliChatRef>(null);
  return (
    <WalliChat
      ref={chat}
      defaultScrollToBottom={${loadAtTop}}
      messages={initialPage}
      onEndReachedThreshold={0.2}
      onEndReached={async () => {
        const nextPage = await loadNextPage();
        chat.current?.${method}(nextPage);
      }}
      style={{ height: 640 }}
    />
  );
}`;
}

function composer(extra: string, initialValue = ""): string {
  return `import { useState } from "react";
import { WalliChatComposer } from "walli_chat/react";

export function Example() {
  const [value, setValue] = useState(${JSON.stringify(initialValue)});
  return (
    <WalliChatComposer
      value={value}
      onValueChange={setValue}
      ${extra}
      onSubmit={(markdown, text, assets) =>
        console.log({ markdown, text, assets })
      }
    />
  );
}`;
}
