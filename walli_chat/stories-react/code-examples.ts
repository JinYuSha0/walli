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
  return `import { WalliChat, type WalliChatMessage } from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";

const messages: WalliChatMessage[] = ${JSON.stringify(messages, null, 2)};

export function Example() {
  return <WalliChat messages={messages} style={{ height: ${height} }} />;
}`;
}

export const exampleSources = {
  deleteMessages: `import { useRef, useState } from "react";
import {
  WalliChat,
  type WalliChatMessage,
  type WalliChatRef,
} from "@wallilabs/chat/react";

const initialMessages: WalliChatMessage[] = [
  { id: "user-1", role: "user", markdown: "Keep this message." },
  { id: "assistant-1", role: "assistant", markdown: "This reply can be deleted." },
  { id: "user-2", role: "user", markdown: "This message can also be deleted." },
];

export function Example() {
  const chat = useRef<WalliChatRef>(null);
  const [messages, setMessages] = useState(initialMessages);

  return (
    <>
      <button onClick={() => chat.current?.deleteMessages(["assistant-1", "user-2"])}>
        Delete two messages
      </button>
      <button onClick={() => setMessages([...initialMessages])}>Reset</button>
      <WalliChat ref={chat} messages={messages} style={{ height: 560 }} />
    </>
  );
}`,
  editMessage: `import { useRef } from "react";
import {
  WalliChat,
  WalliChatComposer,
  type WalliChatAction,
  type WalliChatEditActionData,
  type WalliChatRef,
} from "@wallilabs/chat/react";

type EditAction = WalliChatAction<{}, { "edit-block": WalliChatEditActionData }>;

export function Example() {
  const chat = useRef<WalliChatRef>(null);

  async function handleAction(action: EditAction) {
    switch (action.type) {
      case "edit":
        action.edit(action.messageId);
        break;
      case "block":
        if (action.name !== "edit-block" || action.data.action === "cancel") break;
        action.deleteMessages(
          action.data.messages.slice(action.data.messageIndex).map((message) => message.id),
          { maintainHeight: true },
        );
        await action.submit(action.markdown);
        break;
    }
  }

  return (
    <WalliChat
      ref={chat}
      actionConfig={{ user: { edit: { visible: true, sort: 2 } } }}
      messages={messages}
      onAction={handleAction}
      style={{ height: 640 }}
    >
      <WalliChatComposer
        slot="composer"
        value=""
        onSubmit={async (markdown) => {
          chat.current?.insertMessagesAtBottom([
            { id: crypto.randomUUID(), role: "user", markdown },
          ]);
          // Start the new assistant response here.
        }}
      />
    </WalliChat>
  );
}`,
  actions: `import { Sparkles, ThumbsDown, ThumbsUp, type IconNode } from "lucide";
import { html } from "lit";
function fillIcon(icon: IconNode): IconNode {
  return icon.map(([tag, attributes]) => [tag, { ...attributes, fill: "currentColor" }]);
}

import { WalliChat, type WalliChatAction, type WalliChatMessage } from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";

const messages: WalliChatMessage[] = [
  {
    id: "user-1",
    role: "user",
    markdown: "Can these actions be customized?",
  },
  {
    id: "assistant-1",
    role: "assistant",
    markdown: "Yes. Click an action.",
  },
];

function handleAction(action: WalliChatAction) {
  if (action.type === "feedback" && "feedback" in action) {
    action.setIcon(fillIcon(action.feedback === "like" ? ThumbsUp : ThumbsDown));
    const other = action.feedback === "like" ? "dislike" : "like";
    action.setIcon(undefined, other);
  }
}

export function Example() {
  return (
    <WalliChat
      actionConfig={{
        assistant: {
          copy: { visible: true, sort: 1 },
          feedback: { visible: true, sort: 2 },
          share: { visible: true, sort: 3 },
          enhance: {
            component: ({ blockStates, setIcon }) => html\`
          <details style="position:relative;width:32px;height:32px">
            <summary
              style="box-sizing:border-box;display:flex;width:32px;height:32px;cursor:pointer;list-style:none;align-items:center;justify-content:center;border-radius:8px"
              title="Enhance"
              >✨</summary
            >
            <div
              style="position:absolute;z-index:10;bottom:calc(100% + 8px);left:50%;width:180px;transform:translateX(-50%);border:1px solid #e5e7eb;border-radius:12px;background:white;color:#111827;padding:12px;box-shadow:0 12px 32px rgb(0 0 0 / 18%);"
            >
              <strong>Enhance response</strong>
              <p style="margin:6px 0 10px;font-size:12px;color:#6b7280">
                State entries: \${blockStates?.size ?? 0}
              </p>
              <button type="button" @click=\${() => setIcon(fillIcon(Sparkles))}>Apply</button>
            </div>
          </details>
        \`,
            label: "Enhance",
            sort: 4,
            type: "enhance",
            visible: true,
          },
        },
        user: {
          edit: { visible: true, sort: 1 },
          copy: { visible: true, sort: 2 },
        },
      }}
      messages={messages}
      onAction={handleAction}
      style={{ height: 320 }}
    />
  );
}`,
  initialIndex: `import { WalliChat } from "@wallilabs/chat/react";

const messages = [
  { id: "day-1-user", role: "user", markdown: "Day 1", createdAt: Date.UTC(2026, 7, 24, 9) },
  { id: "day-1-reply", role: "assistant", markdown: "First reply", createdAt: Date.UTC(2026, 7, 24, 9, 15) },
  // Additional messages from day 2 and day 3...
];

export function Example() {
  return (
    <WalliChat
      defaultScrollToIndex={8}
      intervalSeconds={6 * 60 * 60}
      messages={messages}
      style={{ height: 640 }}
    />
  );
}`,
  conversation: chat(conversation),
  timeMessages: `import { WalliChat, type WalliChatMessage } from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";

const now = Date.now();
const messages: WalliChatMessage[] = [
  { id: "time-user-1", role: "user", markdown: "First message", createdAt: now - 20 * 60_000 },
  { id: "time-assistant-1", role: "assistant", markdown: "First reply", createdAt: now - 19 * 60_000 },
  { id: "time-user-2", role: "user", markdown: "Twelve minutes after the previous user message", createdAt: now - 8 * 60_000 },
];

export function Example() {
  return (
    <WalliChat
      intervalSeconds={10 * 60}
      messages={messages}
      timeFormatter={(createdAt) => new Date(createdAt).toLocaleString()}
      style={{ height: 640 }}
    />
  );
}`,
  reasoningStream: `import { useRef, useState } from "react";
import { WalliChat, type WalliChatRef } from "@wallilabs/chat/react";
import { createReasoningStorySseStream } from "./story-stream";

export function ReasoningStream() {
  const chat = useRef<WalliChatRef>(null);
  const [running, setRunning] = useState(false);

  async function start() {
    if (!chat.current || running) return;
    setRunning(true);
    try {
      await chat.current.insertStreamingMessageAtBottom(
        createReasoningStorySseStream(),
        {
          messageId: crypto.randomUUID(),
          reasoningLabels: { thinking: "Thinking", thought: "Thought" },
          stickToBottom: true,
        },
      ).finished;
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <button disabled={running} onClick={start}>Start reasoning stream</button>
      <WalliChat ref={chat} messages={[]} style={{ height: 560 }} />
    </>
  );
}`,
  richMarkdown: chat(markdownShowcase),
  userMessage: chat(userMessage, 240),
  assistantMessage: chat(assistantMessage, 640),
  imageMessage: chat(imageMessage),
  customBlock: `import { useEffect, useMemo } from "react";
import { WalliChat, registerBlock } from "@wallilabs/chat/react";
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
} from "@wallilabs/chat/react";
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
import { WalliChat } from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";

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
import { WalliChat, type WalliChatMessage, type WalliChatRef } from "@wallilabs/chat/react";

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
  insertMessages: `import { useRef, useState } from "react";
import {
  WalliChat,
  type WalliChatRef,
  type WalliChatMessage,
} from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";

const initialMessages: WalliChatMessage[] = Array.from(
  { length: 20 },
  (_, i) => ({
    id: "initial-" + i,
    role: i % 2 === 0 ? "user" : "assistant",
    markdown: "Initial message " + (i + 1),
  }),
);

export function Example() {
  const chat = useRef<WalliChatRef>(null);
  const [stick, setStick] = useState(false);
  const insert = (top: boolean) => {
    const messages: WalliChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        markdown: top ? "Older message" : "New message",
      },
    ];
    if (top) chat.current?.insertMessagesAtTop(messages, { stick });
    else chat.current?.insertMessagesAtBottom(messages, { stick });
  };
  return (
    <>
      <button onClick={() => insert(true)}>Insert at top</button>
      <button onClick={() => insert(false)}>Insert at bottom</button>
      <label>
        <input
          type="checkbox"
          checked={stick}
          onChange={(e) => setStick(e.target.checked)}
        />{" "}
        Stick
      </label>
      <button
        onClick={() =>
          chat.current?.insertMessagesAtBottom(
            [
              {
                id: crypto.randomUUID(),
                role: "assistant",
                markdown:
                  "An update has arrived. Here is some additional information for our conversation.",
              },
            ],
            {
              animation: "slide-in",
              // Wait for active streams; otherwise insert immediately.
              waitForStreaming: true,
              stick: true,
            },
          )
        }
      >
        Insert with animation
      </button>
      <WalliChat
        ref={chat}
        messages={initialMessages}
        style={{ display: "block", height: 640 }}
      />
    </>
  );
}`,
  responsive: `import { useState } from "react";
import { WalliChat, type WalliChatProps, type WalliChatMessage } from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";

const messages: WalliChatMessage[] = [
  { id: "user", role: "user", markdown: "How does responsive layout work?" },
  { id: "assistant", role: "assistant", markdown: "Switch breakpoints to compare message spacing and bubble widths." },
];
export function Example() {
  const [responsive, setResponsive] = useState<WalliChatProps["responsive"]>("xl");
  return <>
    <p>The breakpoint is shared globally. Auto uses the viewport width.</p>
    <div role="group" aria-label="Responsive breakpoint">
      {(["auto", "base", "sm", "md", "lg", "xl", "2xl"] as const).map(value => (
        <button key={value} aria-pressed={(responsive ?? "auto") === value}
          onClick={() => setResponsive(value === "auto" ? undefined : value)}>{value}</button>
      ))}
    </div>
    <WalliChat responsive={responsive} messages={messages} style={{ display: "block", height: 640 }} />
  </>;
}`,
  replaceMessage: `import { useRef } from "react";
import { WalliChat, type WalliChatRef } from "@wallilabs/chat/react";

export function Example() {
  const chat = useRef<WalliChatRef>(null);
  const version = useRef(1);
  const messageId = useRef("message-1");

  const replace = () => {
    const nextVersion = version.current + 1;
    const nextId = \`message-\${nextVersion}\`;
    if (chat.current?.replaceMessage(messageId.current, {
      id: nextId,
      markdown: \`## Message \${nextVersion}\`,
    })) {
      version.current = nextVersion;
      messageId.current = nextId;
    }
  };

  return (
    <>
      <button onClick={replace}>Replace message</button>
      <WalliChat
        ref={chat}
        messages={[{ id: "message-1", role: "assistant", markdown: "## Message 1" }]}
        style={{ height: 640 }}
      />
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
} from "@wallilabs/chat/react";
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
          { icon: Paperclip, title: "Add files", onClick: () => console.info("Add files") },
          { icon: Search, title: "Search the web", onClick: () => console.info("Search") },
          { icon: ImagePlus, title: "Insert image", onClick: () => console.info("Insert image") },
          {
            icon: FileSpreadsheet,
            title: "Insert spreadsheet",
            onClick: () => console.info("Insert spreadsheet"),
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
              bottomPaddingHeight: ((chat.current.element?.clientHeight ?? 720) * 2) / 3,
              messageId: crypto.randomUUID(),
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
import { WalliChatComposer } from "@wallilabs/chat/react";

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
import { WalliChatComposer } from "@wallilabs/chat/react";

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
import { WalliChatComposer, type WalliChatComposerRef } from "@wallilabs/chat/react";

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
import { WalliChat, type WalliChatRef } from "@wallilabs/chat/react";

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
import { WalliChatComposer } from "@wallilabs/chat/react";

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
