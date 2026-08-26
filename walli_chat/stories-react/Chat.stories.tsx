import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FileSpreadsheet, ImagePlus, Search } from "lucide";
import {
  WalliChat,
  WalliChatComposer,
  registerBlock,
  type WalliChatMessage,
  type WalliChatRef,
  type WalliChatStreamingHandle,
} from "../src/react";
import {
  assistantMessage,
  conversation,
  customBlockMessage,
  imageMessage,
  markdownShowcase,
  mockFullChatTranscription,
  mockFullChatUpload,
  replaceBlockMessage,
  replaceToolCallBlockDefinition,
  userMessage,
} from "../stories/ChatMessage.stories";
import { source } from "./source";
import { exampleSources } from "./code-examples";
import { fullChatWelcomeMessages } from "./full-chat-data";
import { createStorySseStream } from "./story-stream";

type Args = { messages: WalliChatMessage[] };
const chatStyle: CSSProperties = { display: "block", height: "100%", width: "100%" };
const noMessages: WalliChatMessage[] = [];
const buttonStyle: CSSProperties = {
  cursor: "pointer",
  border: "1px solid var(--walli-border)",
  borderRadius: 999,
  background: "var(--walli-card)",
  color: "var(--walli-card-foreground)",
  padding: "8px 14px",
  font: "600 13px sans-serif",
};

function ChatSurface({ messages, compact = false }: Args & { compact?: boolean }) {
  return (
    <div
      style={{ height: compact ? 240 : 640, width: "100%", background: "var(--walli-background)" }}
    >
      <WalliChat
        messages={messages}
        onFeedback={(id, _markdown, feedback) => console.info("Feedback", { id, feedback })}
        onReply={(id) => console.info("Reply", { id })}
        onShare={(id) => console.info("Share", { id })}
        style={chatStyle}
      />
    </div>
  );
}

const meta = {
  title: "React/Chat",
  component: WalliChat,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "React versions of every walli-chat demo." } },
  },
  args: { messages: conversation },
  render: (args) => <ChatSurface {...args} />,
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;

export const FullChat: Story = {
  render: () => <FullChatDemo />,
  parameters: source(exampleSources.fullChat),
};
export const Conversation: Story = { parameters: source(exampleSources.conversation) };
export const RichMarkdown: Story = {
  args: { messages: markdownShowcase },
  parameters: source(exampleSources.richMarkdown),
};
export const UserMessage: Story = {
  args: { messages: userMessage },
  render: (args) => <ChatSurface {...args} compact />,
  parameters: source(exampleSources.userMessage),
};
export const AssistantMessage: Story = {
  args: { messages: assistantMessage },
  render: (args) => <ChatSurface {...args} compact />,
  parameters: source(exampleSources.assistantMessage),
};
export const ImageMessage: Story = {
  args: { messages: imageMessage },
  parameters: source(exampleSources.imageMessage),
};
export const CustomBlock: Story = {
  args: { messages: customBlockMessage },
  parameters: source(exampleSources.customBlock),
};
export const RepalceBlock: Story = {
  render: () => <ReplaceBlockDemo />,
  parameters: source(exampleSources.replaceBlock),
};
export const ThemeToggle: Story = {
  render: () => <ThemeToggleDemo />,
  parameters: source(exampleSources.themeToggle),
};
export const ScrollControls: Story = {
  render: () => <ScrollControlsDemo />,
  parameters: source(exampleSources.scrollControls),
};
export const InsertMessages: Story = {
  render: () => <InsertMessagesDemo />,
  parameters: source(exampleSources.insertMessages),
};
export const LoadOlderAtTop: Story = {
  render: () => <PaginationDemo loadAtTop />,
  parameters: source(exampleSources.loadOlder),
};
export const LoadNewerAtBottom: Story = {
  render: () => <PaginationDemo loadAtTop={false} />,
  parameters: source(exampleSources.loadNewer),
};

function ReplaceBlockDemo() {
  const chat = useRef<WalliChatRef>(null);
  useEffect(() => {
    const element = chat.current?.element;
    if (!element) return;

    const registration = registerBlock(replaceToolCallBlockDefinition);
    try {
      element.messages = replaceBlockMessage;
    } finally {
      registration.unregister();
    }
  }, []);

  return (
    <div style={{ height: 320, width: "100%", background: "var(--walli-background)" }}>
      <WalliChat ref={chat} messages={noMessages} style={chatStyle} />
    </div>
  );
}

function ThemeToggleDemo() {
  const [dark, setDark] = useState(false);
  return (
    <div
      className={dark ? "dark" : undefined}
      style={{
        boxSizing: "border-box",
        display: "flex",
        height: 520,
        width: "100%",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        colorScheme: dark ? "dark" : "light",
        background: "var(--walli-background)",
      }}
    >
      <button
        type="button"
        aria-pressed={dark}
        style={{ ...buttonStyle, alignSelf: "flex-start" }}
        onClick={() => setDark((value) => !value)}
      >
        <span aria-hidden="true">{dark ? "☀" : "☾"}</span>{" "}
        {dark ? "Switch to light mode" : "Switch to dark mode"}
      </button>
      <ChatPanel>
        <WalliChat messages={conversation} style={chatStyle} />
      </ChatPanel>
    </div>
  );
}

const scrollMessages = Array.from({ length: 40 }, (_, index): WalliChatMessage => ({
  id: `react-scroll-${index}`,
  role: index % 2 === 0 ? "user" : "assistant",
  markdown:
    index % 2 === 0
      ? `Message **#${index}**: navigate to this item using the index control.`
      : `### Response #${index}\n\nThis message adds enough content to make the conversation scrollable.`,
}));

function ScrollControlsDemo() {
  const chat = useRef<WalliChatRef>(null);
  const [index, setIndex] = useState(20);
  const [animated, setAnimated] = useState(true);
  return (
    <DemoFrame>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <button
          style={buttonStyle}
          onClick={() => chat.current?.scrollTo({ target: "top", animated })}
        >
          Scroll to top
        </button>
        <button
          style={buttonStyle}
          onClick={() => chat.current?.scrollTo({ target: "bottom", animated })}
        >
          Scroll to bottom
        </button>
        <input
          type="number"
          min={0}
          max={scrollMessages.length - 1}
          value={index}
          aria-label="Message index"
          onChange={(event) => setIndex(Number(event.target.value))}
          style={{ width: 100, padding: 8 }}
        />
        <button
          style={buttonStyle}
          onClick={() => chat.current?.scrollToIndex({ index, animated })}
        >
          Scroll to index
        </button>
        <label>
          <input
            type="checkbox"
            role="switch"
            checked={animated}
            onChange={(event) => setAnimated(event.target.checked)}
          />{" "}
          Animated
        </label>
      </div>
      <ChatPanel>
        <WalliChat
          ref={chat}
          defaultScrollToBottom={false}
          messages={scrollMessages}
          style={chatStyle}
        />
      </ChatPanel>
    </DemoFrame>
  );
}

const initialInsertMessages = Array.from({ length: 20 }, (_, index): WalliChatMessage => ({
  id: `react-insert-${index}`,
  role: index % 2 === 0 ? "user" : "assistant",
  markdown:
    index % 2 === 0
      ? `Initial user message **#${index}**.`
      : `### Initial response #${index}\n\nThis is part of the original conversation.`,
}));

function InsertMessagesDemo() {
  const chat = useRef<WalliChatRef>(null);
  const batch = useRef(0);
  const [stick, setStick] = useState(false);
  const insert = (top: boolean) => {
    const current = ++batch.current;
    const messages: WalliChatMessage[] = top
      ? [
          {
            id: `react-top-a-${current}`,
            role: "assistant",
            markdown: `### Older batch #${current}\n\nInserted at the top.`,
          },
          {
            id: `react-top-u-${current}`,
            role: "user",
            markdown: `Loaded older context from batch ${current}.`,
          },
        ]
      : [
          {
            id: `react-bottom-u-${current}`,
            role: "user",
            markdown: `New message from batch ${current}.`,
          },
          {
            id: `react-bottom-a-${current}`,
            role: "assistant",
            markdown: `### New response #${current}\n\nInserted at the bottom.`,
          },
        ];
    if (top) chat.current?.insertMessagesAtTop(messages, { stick });
    else chat.current?.insertMessagesAtBottom(messages, { stick });
  };
  return (
    <DemoFrame>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={buttonStyle} onClick={() => insert(true)}>
          Insert at top
        </button>
        <button style={buttonStyle} onClick={() => insert(false)}>
          Insert at bottom
        </button>
        <label>
          <input
            type="checkbox"
            role="switch"
            checked={stick}
            onChange={(event) => setStick(event.target.checked)}
          />{" "}
          Stick
        </label>
      </div>
      <ChatPanel>
        <WalliChat ref={chat} messages={initialInsertMessages} style={chatStyle} />
      </ChatPanel>
    </DemoFrame>
  );
}

function PaginationDemo({ loadAtTop }: { loadAtTop: boolean }) {
  const chat = useRef<WalliChatRef>(null);
  const page = useRef(1);
  const loading = useRef(false);
  const createPage = (pageNumber: number): WalliChatMessage[] =>
    Array.from({ length: 12 }, (_, index) => {
      const sequence = (pageNumber - 1) * 12 + index;
      return {
        id: `react-page-${pageNumber}-${index}`,
        role: sequence % 2 === 0 ? "user" : "assistant",
        markdown:
          sequence % 2 === 0
            ? `Page ${pageNumber}, user message **#${sequence}**.`
            : `### Page ${pageNumber} response #${sequence}\n\nScroll to the active edge to load another page.`,
      };
    });
  const onEndReached = async () => {
    if (!chat.current || loading.current) return;
    loading.current = true;
    const indicator: WalliChatMessage = {
      id: `react-loading-${page.current + 1}`,
      role: "assistant",
      markdown: ":::loading-block\n:::",
      showActions: false,
    };
    const remove = loadAtTop
      ? chat.current.insertMessagesAtTop([indicator], { stick: true })
      : chat.current.insertMessagesAtBottom([indicator], { stick: true });
    await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
    remove();
    const next = createPage(++page.current);
    if (loadAtTop) chat.current?.insertMessagesAtTop(next);
    else chat.current?.insertMessagesAtBottom(next);
    loading.current = false;
  };
  return (
    <DemoFrame>
      <div style={{ color: "var(--walli-muted-foreground)", font: "500 13px sans-serif" }}>
        {loadAtTop
          ? "Start at bottom · scroll up to load older messages"
          : "Start at top · scroll down to load newer messages"}
      </div>
      <ChatPanel>
        <WalliChat
          ref={chat}
          defaultScrollToBottom={loadAtTop}
          messages={createPage(1)}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.2}
          style={chatStyle}
        />
      </ChatPanel>
    </DemoFrame>
  );
}

function FullChatDemo() {
  const chat = useRef<WalliChatRef>(null);
  const activeStream = useRef<WalliChatStreamingHandle | undefined>(undefined);
  const [value, setValue] = useState("");
  const welcome = useMemo(() => fullChatWelcomeMessages, []);
  return (
    <div style={{ height: 720, width: "100%", background: "var(--walli-background)" }}>
      <WalliChat ref={chat} messages={welcome} style={chatStyle}>
        <WalliChatComposer
          slot="composer"
          placeholder="Message Walli"
          value={value}
          onValueChange={setValue}
          menuItems={[
            { icon: Search, title: "Search the web", onClick: () => console.info("Search") },
            { icon: ImagePlus, title: "Insert image", onClick: () => console.info("Image") },
            {
              icon: FileSpreadsheet,
              title: "Insert spreadsheet",
              onClick: () => console.info("Spreadsheet"),
            },
          ]}
          onUploadImages={mockFullChatUpload}
          onTranscribe={mockFullChatTranscription}
          onCancel={() => activeStream.current?.abort(new DOMException("Cancelled", "AbortError"))}
          onSubmit={async (markdown) => {
            if (!chat.current || !markdown) return;
            chat.current.insertMessagesAtBottom(
              [{ id: `react-user-${crypto.randomUUID()}`, role: "user", markdown }],
              { stick: true },
            );
            setValue("");
            activeStream.current = chat.current.insertStreamingMessageAtBottom(
              createStorySseStream(),
              {
                getToolLabel: (name) => ({ web_search: "Searching the web" })[name] ?? name,
                messageId: `react-assistant-${crypto.randomUUID()}`,
                stickToBottom: true,
              },
            );
            try {
              await activeStream.current.finished;
            } finally {
              activeStream.current = undefined;
            }
          }}
        />
      </WalliChat>
    </div>
  );
}

function DemoFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        height: 720,
        width: "100%",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        background: "var(--walli-background)",
      }}
    >
      {children}
    </div>
  );
}
function ChatPanel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ minHeight: 0, flex: 1, border: "1px solid var(--walli-border)", borderRadius: 16 }}
    >
      {children}
    </div>
  );
}
