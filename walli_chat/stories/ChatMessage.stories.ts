import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";
import { FileSpreadsheet, ImagePlus, Search } from "lucide";
import type {
  WalliChatComposerTranscriptionContext,
  WalliChatMessage,
  WalliChatStreamingHandle,
} from "../src/types";
import type { WalliChatElement } from "../src/web-components/walli-chat";
import type { WalliChatComposerElement } from "../src/web-components/walli-chat-composer";
import { noticeBlockDefinition } from "../demo/blocks/notice-block";
import { registerBlock } from "../src/core/block-registry";
import { toolCallBlockDefinition } from "../src/core/blocks";
import "../src/web-components/walli-chat";
import "../src/web-components/walli-chat-composer";

registerBlock(noticeBlockDefinition);

type Args = {
  messages: WalliChatMessage[];
};

const conversation: WalliChatMessage[] = [
  {
    id: "conversation-user-1",
    role: "user",
    markdown: "How should we structure an exact-height virtualized chat renderer?",
  },
  {
    id: "conversation-assistant-1",
    role: "assistant",
    markdown: [
      "## Recommended structure",
      "",
      "Use three layers:",
      "",
      "1. Parse Markdown into normalized blocks.",
      "2. Measure blocks from known width and typography.",
      "3. Materialize only the visible message range.",
      "",
      "> Once height is known in advance, virtualization becomes geometry instead of guesswork.",
    ].join("\n"),
  },
  {
    id: "conversation-user-2",
    role: "user",
    markdown: "Can you show the frame calculation in TypeScript?",
  },
  {
    id: "conversation-assistant-2",
    role: "assistant",
    markdown: [
      "```ts",
      "const frame = buildConversationFrame(messages, viewportWidth);",
      "const visible = findVisibleRange(frame, scrollTop, viewportHeight);",
      "renderMessages(frame, visible.start, visible.end);",
      "```",
      "",
      "This keeps scrolling stable without measuring mounted DOM nodes.",
    ].join("\n"),
  },
];

const markdownShowcase: WalliChatMessage[] = [
  {
    id: "markdown-user",
    role: "user",
    markdown: "Give me a compact rendering checklist.",
  },
  {
    id: "markdown-assistant",
    role: "assistant",
    markdown: [
      "# Rendering checklist",
      "",
      "This sample mixes **bold**, *italic*, ~~deleted text~~, `inline code`, and [links](https://example.com).",
      "",
      "- [x] Predict bubble height",
      "- [x] Keep user messages compact",
      "- [ ] Run mobile screenshot tests",
      "  - Check long URLs",
      "  - Check CJK、العربية and emoji 👩‍🚀",
      "",
      "| Area | Expected behavior |",
      "| --- | --- |",
      "| Inline | Stable wrapping |",
      "| Code | Preserve whitespace |",
      "| Lists | Predictable indentation |",
      "",
      "---",
      "",
      "Final paragraph after richer blocks.",
    ].join("\n"),
  },
];

const userMessage: WalliChatMessage[] = [
  {
    id: "single-user",
    role: "user",
    markdown:
      "The human side is usually short, compact, and bubble-shaped—even with **emphasis** and `inline code`.",
  },
];

const assistantMessage: WalliChatMessage[] = [
  {
    id: "single-assistant",
    role: "assistant",
    markdown:
      "Assistant content uses a lighter editorial layout. It can be a short answer, a longer explanation, or a structured Markdown response.",
  },
];

const imageMessage: WalliChatMessage[] = [
  {
    id: "image-fixed-user",
    role: "user",
    markdown: "Give me an image of a fixed size.",
  },
  {
    id: "image-fixed-assistant",
    role: "assistant",
    markdown:
      '![image](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZYXcjQI4KQpTXByeK6dpmd6GJY5LPVE6NL3Rd-CbZ7s2UsphrHs1djE8&s=10){width="365" height="547"}',
  },
  {
    id: "image-intrinsic-user",
    role: "user",
    markdown: "Give me two images of unknown dimensions.",
  },
  {
    id: "image-intrinsic-assistant",
    role: "assistant",
    markdown: [
      "![image](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZYXcjQI4KQpTXByeK6dpmd6GJY5LPVE6NL3Rd-CbZ7s2UsphrHs1djE8&s=10)",
      "",
      "![image](https://img.redocn.com/sheji/20250805/jilongpochengshijianzhuriluoquanjing_13631705.jpg.400.jpg)",
    ].join("\n"),
  },
  {
    id: "image-inline-fixed-user",
    role: "user",
    markdown: "Show fixed-size inline images mixed with wrapping text.",
  },
  {
    id: "image-inline-fixed-assistant",
    role: "assistant",
    markdown: [
      "Fixed-size inline images start here",
      '![grinning](https://github.githubassets.com/images/icons/emoji/unicode/1f600.png?v8){width="20" height="20"}',
      "then continue with text",
      '![rocket](https://github.githubassets.com/images/icons/emoji/unicode/1f680.png?v8){width="20" height="20"}',
      "and keep a predictable line height while wrapping across the available width.",
    ].join(" "),
  },
  {
    id: "image-inline-intrinsic-user",
    role: "user",
    markdown: "Now show inline images without fixed dimensions.",
  },
  {
    id: "image-inline-intrinsic-assistant",
    role: "assistant",
    markdown: [
      "Inline image wrapping starts with text",
      '![wide coastline](https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&h=240&q=80){width="640" height="240"}',
      "then continues with enough trailing words to verify that a wider image and ordinary text wrap together naturally across multiple lines.",
    ].join(" "),
  },
];

const customBlockMessage: WalliChatMessage[] = [
  {
    id: "custom-block-user",
    role: "user",
    markdown: "Can a product-specific block render inside an assistant message?",
  },
  {
    id: "custom-block-assistant",
    role: "assistant",
    markdown: [
      "The renderer can be extended without changing the built-in Markdown blocks.",
      "",
      ":::notice",
      "This notice is tokenized, measured, and rendered by a registered custom block.",
      ":::",
      "",
      "Content after the custom block continues as ordinary Markdown.",
    ].join("\n"),
  },
];

const customBlockSource = `import {
  layoutWithLines,
  measureLineStats,
  prepareWithSegments,
} from "@chenglou/pretext";
import { html } from "lit";
import { registerBlock } from "walli_chat";

const padding = 16;
const lineHeight = 22;
const font = '500 14px ui-sans-serif, system-ui, sans-serif';

const noticeBlockDefinition = {
  name: "notice",
  marginTop: 12,
  styles: \`
    :host { display: block; width: 100%; height: 100%; }
    .notice {
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid color-mix(in oklch, var(--walli-foreground) 16%, transparent);
      border-radius: 12px;
      background: color-mix(in oklch, var(--walli-foreground) 6%, transparent);
      color: var(--walli-foreground);
    }
    .line { position: absolute; white-space: pre; }
  \`,
  tokenizer: {
    tokenize(source) {
      const match = /^:::notice[ \\t]*\\n([\\s\\S]*?)\\n:::[ \\t]*(?:\\n|$)/.exec(source);
      if (!match) return undefined;
      return { data: { text: match[1].trim() }, raw: match[0] };
    },
  },
  prepare(data) {
    return { ...data, prepared: prepareWithSegments(data.text, font) };
  },
  measure(data, { availableWidth }) {
    const contentWidth = Math.max(1, availableWidth - padding * 2);
    const { lineCount } = measureLineStats(data.prepared, contentWidth);
    return {
      height: padding * 2 + lineCount * lineHeight,
      width: availableWidth,
    };
  },
  render({ data, height, width }) {
    const contentWidth = Math.max(1, width - padding * 2);
    const layout = layoutWithLines(data.prepared, contentWidth, lineHeight);
    return html\`<div class="notice" style=\${\`width:\${width}px;height:\${height}px\`}>
      \${layout.lines.map(
        (line, index) => html\`<div
          class="line"
          style=\${\`left:\${padding}px;top:\${padding + index * lineHeight}px\`}
        >\${line.text}</div>\`,
      )}
    </div>\`;
  },
};

const registration = registerBlock(noticeBlockDefinition);

const chat = document.querySelector("walli-chat");
chat.messages = [
  {
    id: "custom-block-assistant",
    role: "assistant",
    markdown: [
      ":::notice",
      "This notice is rendered by a registered custom block.",
      ":::",
    ].join("\\n"),
  },
];

// Call when the extension is no longer needed:
// registration.unregister();`;

const replaceToolCallBlockDefinition = {
  ...toolCallBlockDefinition,
  measure(data, context) {
    const iconSpace = 26;
    const metrics = toolCallBlockDefinition.measure(data, {
      availableWidth: Math.max(1, context.availableWidth - iconSpace),
    });
    return { ...metrics, width: context.availableWidth };
  },
  render(context) {
    return html`<div style="position:relative;box-sizing:border-box;height:100%;padding-left:26px">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="position:absolute;left:0;top:50%;width:16px;height:16px;transform:translateY(-50%);color:var(--foreground, var(--walli-foreground))"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.3-4.3"></path>
      </svg>
      ${toolCallBlockDefinition.render(context)}
    </div>`;
  },
} satisfies typeof toolCallBlockDefinition;

const replaceBlockMessage: WalliChatMessage[] = [
  {
    id: "replace-block-user",
    role: "user",
    markdown: "Search the documentation for the custom block API.",
  },
  {
    id: "replace-block-assistant",
    role: "assistant",
    markdown: [
      "I will check the component documentation first.",
      "",
      ":::toolcall-block",
      '{"toolCallId":"search-docs","toolName":"web_search","label":"Searching the documentation"}',
      ":::",
      "",
      "The registered replacement keeps the original tool-call presentation and adds a leading search icon.",
    ].join("\n"),
  },
];

const replaceBlockSource = `import { html } from "lit";
import {
  registerBlock,
  toolCallBlockDefinition,
} from "walli_chat";

const replacement = {
  ...toolCallBlockDefinition,
  measure(data, context) {
    const iconSpace = 26;
    const metrics = toolCallBlockDefinition.measure(data, {
      availableWidth: Math.max(1, context.availableWidth - iconSpace),
    });
    return { ...metrics, width: context.availableWidth };
  },
  render(context) {
    return html\`<div
      style="position:relative;box-sizing:border-box;height:100%;padding-left:26px"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="position:absolute;left:0;top:50%;width:16px;height:16px;transform:translateY(-50%);color:var(--foreground, var(--walli-foreground))"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.3-4.3"></path>
      </svg>
      \${toolCallBlockDefinition.render(context)}
    </div>\`;
  },
};

const chat = document.querySelector("walli-chat");
const registration = registerBlock(replacement);
try {
  chat.messages = [
    {
      id: "tool-call",
      role: "assistant",
      markdown: [
        ":::toolcall-block",
        '{"toolCallId":"search-docs","toolName":"web_search","label":"Searching the documentation"}',
        ":::",
      ].join("\\n"),
    },
  ];
} finally {
  // Prepared messages retain the replacement; other chats use the original block.
  registration.unregister();
}`;

function createChatSource(messages: readonly WalliChatMessage[]): string {
  return `<walli-chat></walli-chat>

<script type="module">
  const chat = document.querySelector("walli-chat");
  chat.messages = ${JSON.stringify(messages, null, 2).split("\n").join("\n  ")};
</script>`;
}

const meta: Meta<Args> = {
  title: "Components/Chat Message",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Message scenarios rendered through walli-chat, so layout, actions, Markdown blocks, and virtualization match production behavior.",
      },
    },
  },
  args: {
    messages: conversation,
  },
  render: ({ messages }) => html`
    <div style="height:640px;width:100%;background:var(--walli-background)">
      <walli-chat
        style="display:block;height:100%;width:100%"
        .messages=${messages}
        .onFeedback=${(id: string, _markdown: string, feedback: string) =>
          console.info("Feedback", { id, feedback })}
        .onReply=${(id: string) => console.info("Reply", { id })}
        .onShare=${(id: string) => console.info("Share", { id })}
      ></walli-chat>
    </div>
  `,
};

export default meta;
type Story = StoryObj<Args>;

export const FullChat: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A complete chat surface with messages, Composer actions, uploads, transcription, cancellation, and simulated streaming output.",
      },
      source: {
        code: `<walli-chat>
  <walli-chat-composer slot="composer" placeholder="Message Walli"></walli-chat-composer>
</walli-chat>

<script type="module">
  import "walli_chat";

  const chat = document.querySelector("walli-chat");
  const composer = document.querySelector("walli-chat-composer");
  let activeStream;

  chat.messages = [
    { id: "welcome", role: "assistant", markdown: "## Welcome to Walli\\n\\nSend a message to start the streaming demo." },
  ];
  chat.onFeedback = () => {};
  chat.onReply = () => {};
  chat.onShare = () => {};

  composer.onSubmit = async (markdown) => {
    chat.insertMessagesAtBottom([
      { id: crypto.randomUUID(), role: "user", markdown },
    ], { stick: true });
    composer.value = "";

    activeStream = chat.insertStreamingMessageAtBottom(createSseStream(), {
      getToolLabel: (name) => ({
        web_search: "Searching the web",
      })[name] ?? name,
      messageId: crypto.randomUUID(),
      stickToBottom: true,
    });
    await activeStream.finished;
    activeStream = undefined;
  };

  composer.onCancel = () => activeStream?.abort();

  function createSseStream() {
    const records = [
      {
        event: "delta",
        data: {
          text: [
            "## Analysis",
            "",
            "1. Inspect context",
            "   - Read messages",
            "   - Extract requirements",
            "     - Keep streaming",
            "     - Test nesting",
            "",
          ].join("\\n"),
        },
      },
      {
        event: "tool-call",
        data: {
          toolCallId: "search-1",
          toolName: "web_search",
          input: { query: "streaming Markdown tables" },
        },
      },
      {
        event: "tool-result",
        data: {
          toolCallId: "search-1",
          toolName: "web_search",
          output: { results: 3 },
        },
      },
      {
        event: "delta",
        data: {
          text: [
            "Search completed.",
            "",
            "| Capability | Result |",
            "| --- | --- |",
            "| Nested lists | Stable |",
            "| Tool calls | Visible |",
          ].join("\\n"),
        },
      },
    ];
    let index = 0;

    return new ReadableStream({
      async pull(controller) {
        if (index === records.length) return controller.close();
        const record = records[index++];
        await new Promise((resolve) =>
          setTimeout(resolve, record.event === "tool-result" ? 2000 : 600),
        );
        controller.enqueue(
          "event: " + record.event + "\\ndata: " + JSON.stringify(record.data) + "\\n\\n",
        );
      },
    });
  }
</script>`,
      },
    },
  },
  render: () => renderFullChat(),
};

export const Conversation: Story = {
  parameters: {
    docs: {
      source: {
        code: createChatSource(conversation),
      },
    },
  },
};

export const RichMarkdown: Story = {
  args: { messages: markdownShowcase },
  parameters: {
    docs: {
      description: {
        story: "A reduced version of the demo's nested Markdown stress case.",
      },
      source: {
        code: createChatSource(markdownShowcase),
      },
    },
  },
};

export const UserMessage: Story = {
  args: { messages: userMessage },
  render: ({ messages }) => renderCompactMessages(messages),
  parameters: {
    docs: {
      source: { code: createChatSource(userMessage) },
    },
  },
};

export const AssistantMessage: Story = {
  args: { messages: assistantMessage },
  render: ({ messages }) => renderCompactMessages(messages),
  parameters: {
    docs: {
      source: { code: createChatSource(assistantMessage) },
    },
  },
};

export const ImageMessage: Story = {
  args: { messages: imageMessage },
  parameters: {
    docs: {
      description: {
        story:
          "Compares fixed emoji dimensions with a wider inline photo that has no explicit dimensions.",
      },
      source: { code: createChatSource(imageMessage) },
    },
  },
};

export const CustomBlock: Story = {
  args: { messages: customBlockMessage },
  parameters: {
    docs: {
      description: {
        story:
          "Registers a notice tokenizer with explicit measurement, isolated styles, and a Lit renderer, then activates it from Markdown.",
      },
      source: {
        code: customBlockSource,
        language: "ts",
      },
    },
  },
};

export const RepalceBlock: Story = {
  render: () => renderReplaceBlock(),
  parameters: {
    docs: {
      description: {
        story:
          "Replaces the built-in tool-call block definition while preserving its tokenizer and original renderer, then adds a leading search icon.",
      },
      source: {
        code: replaceBlockSource,
        language: "ts",
      },
    },
  },
};

export const ThemeToggle: Story = {
  parameters: {
    docs: {
      description: {
        story: "Switches the chat surface between the built-in light and dark theme tokens.",
      },
      source: {
        code: `<div id="theme-demo">
  <button id="theme" type="button" aria-pressed="false">
    <span aria-hidden="true">☾</span>
    <span>Switch to dark mode</span>
  </button>
  <walli-chat></walli-chat>
</div>

<script type="module">
  import "walli_chat";

  const demo = document.querySelector("#theme-demo");
  const button = document.querySelector("#theme");
  button.onclick = () => {
    const dark = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(dark));
    button.lastElementChild.textContent = dark
      ? "Switch to light mode"
      : "Switch to dark mode";
    demo.classList.toggle("dark", dark);
    demo.style.colorScheme = dark ? "dark" : "light";
  };
</script>`,
      },
    },
  },
  render: () => renderThemeToggle(),
};

export const ScrollControls: Story = {
  parameters: {
    docs: {
      description: {
        story: "Exercises the public APIs for scrolling to the top, bottom, or a message index.",
      },
      source: {
        code: `<button id="top">Scroll to top</button>
<button id="bottom">Scroll to bottom</button>
<input id="index" type="number" min="0" value="20" />
<button id="go">Scroll to index</button>
<label><input id="animated" type="checkbox" checked /> Animated</label>
<walli-chat></walli-chat>

<script type="module">
  import "walli_chat";

  const chat = document.querySelector("walli-chat");
  const index = document.querySelector("#index");
  const animated = document.querySelector("#animated");

  chat.messages = messages;
  document.querySelector("#top").onclick = () =>
    chat.scrollTo({ target: "top", animated: animated.checked });
  document.querySelector("#bottom").onclick = () =>
    chat.scrollTo({ target: "bottom", animated: animated.checked });
  document.querySelector("#go").onclick = () =>
    chat.scrollToIndex({ index: Number(index.value), animated: animated.checked });
</script>`,
      },
    },
  },
  render: () => renderScrollControls(),
};

export const InsertMessages: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Inserts message batches at either edge of the conversation while preserving the current viewport.",
      },
      source: {
        code: `<button id="prepend">Insert at top</button>
<button id="append">Insert at bottom</button>
<label><input id="stick" type="checkbox" /> Stick</label>
<walli-chat></walli-chat>

<script type="module">
  import "walli_chat";

  const chat = document.querySelector("walli-chat");
  const stick = document.querySelector("#stick");
  chat.messages = initialMessages;

  document.querySelector("#prepend").onclick = () => {
    chat.insertMessagesAtTop([
      { id: crypto.randomUUID(), role: "assistant", markdown: "### Older message" },
      { id: crypto.randomUUID(), role: "user", markdown: "Loaded at the top." },
    ], { stick: stick.checked });
  };

  document.querySelector("#append").onclick = () => {
    chat.insertMessagesAtBottom([
      { id: crypto.randomUUID(), role: "user", markdown: "A new message." },
      { id: crypto.randomUUID(), role: "assistant", markdown: "Inserted at the bottom." },
    ], { stick: stick.checked });
  };
</script>`,
      },
    },
  },
  render: () => renderInsertMessages(),
};

export const LoadOlderAtTop: Story = {
  parameters: {
    docs: {
      description: {
        story: "Starts at the bottom and loads older pages when the user scrolls to the top.",
      },
      source: {
        code: createPaginationSource(true),
      },
    },
  },
  render: () => renderPaginationLoading(true),
};

export const LoadNewerAtBottom: Story = {
  parameters: {
    docs: {
      description: {
        story: "Starts at the top and loads newer pages when the user scrolls to the bottom.",
      },
      source: {
        code: createPaginationSource(false),
      },
    },
  },
  render: () => renderPaginationLoading(false),
};

function createPaginationSource(loadAtTop: boolean): string {
  return `<walli-chat></walli-chat>

<script type="module">
  import "walli_chat";

  const chat = document.querySelector("walli-chat");
  chat.defaultScrollToBottom = ${loadAtTop};
  chat.messages = createPage(1);
  chat.onEndReachedThreshold = 0.2;
  chat.onEndReached = async () => {
    const removeLoading = chat.${loadAtTop ? "insertMessagesAtTop" : "insertMessagesAtBottom"}(
      [loadingMessage],
      { stick: true },
    );

    await new Promise((resolve) => setTimeout(resolve, 800));
    removeLoading();

    chat.${loadAtTop ? "insertMessagesAtTop" : "insertMessagesAtBottom"}(createNextPage());
  };
</script>`;
}

function renderCompactMessages(messages: WalliChatMessage[]) {
  return html`
    <div style="height:240px;width:100%;background:var(--walli-background)">
      <walli-chat
        style="display:block;height:100%;width:100%"
        .messages=${messages}
        .onFeedback=${() => undefined}
        .onReply=${() => undefined}
        .onShare=${() => undefined}
      ></walli-chat>
    </div>
  `;
}

function renderReplaceBlock() {
  return html`
    <div style="height:320px;width:100%;background:var(--walli-background)">
      <walli-chat
        ${ref((element) => {
          if (!(element instanceof HTMLElement)) return;
          const registration = registerBlock(replaceToolCallBlockDefinition);
          try {
            (element as WalliChatElement).messages = replaceBlockMessage;
          } finally {
            registration.unregister();
          }
        })}
        style="display:block;height:100%;width:100%"
      ></walli-chat>
    </div>
  `;
}

function renderScrollControls() {
  let chat: WalliChatElement | undefined;
  let indexInput: HTMLInputElement | undefined;
  let animatedInput: HTMLInputElement | undefined;
  const messages = Array.from({ length: 40 }, (_, index): WalliChatMessage => ({
    id: `scroll-message-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    markdown:
      index % 2 === 0
        ? `Message **#${index}**: navigate to this item using the index control.`
        : [
            `### Response #${index}`,
            "",
            "This message adds enough content to make the conversation scrollable.",
          ].join("\n"),
  }));
  const buttonStyle =
    "cursor:pointer;border:1px solid var(--walli-border);border-radius:999px;background:var(--walli-card);color:var(--walli-card-foreground);padding:8px 14px;font:600 13px sans-serif";

  return html`
    <div
      style="box-sizing:border-box;display:flex;height:720px;width:100%;flex-direction:column;gap:12px;padding:16px;background:var(--walli-background)"
    >
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
        <button
          type="button"
          style=${buttonStyle}
          @click=${() =>
            chat?.scrollTo({ target: "top", animated: animatedInput?.checked ?? true })}
        >
          Scroll to top
        </button>
        <button
          type="button"
          style=${buttonStyle}
          @click=${() =>
            chat?.scrollTo({ target: "bottom", animated: animatedInput?.checked ?? true })}
        >
          Scroll to bottom
        </button>
        <input
          ${ref((element) => {
            if (element instanceof HTMLInputElement) indexInput = element;
          })}
          type="number"
          min="0"
          max=${messages.length - 1}
          value="20"
          aria-label="Message index"
          style="box-sizing:border-box;width:100px;border:1px solid var(--walli-border);border-radius:8px;background:var(--walli-card);color:var(--walli-card-foreground);padding:8px"
        />
        <button
          type="button"
          style=${buttonStyle}
          @click=${() => {
            const index = Math.max(
              0,
              Math.min(messages.length - 1, Math.floor(Number(indexInput?.value) || 0)),
            );
            chat?.scrollToIndex({ index, animated: animatedInput?.checked ?? true });
          }}
        >
          Scroll to index
        </button>
        <label
          style="display:inline-flex;cursor:pointer;align-items:center;gap:7px;color:var(--walli-foreground);font:500 13px sans-serif"
        >
          <input
            ${ref((element) => {
              if (element instanceof HTMLInputElement) animatedInput = element;
            })}
            type="checkbox"
            checked
            role="switch"
          />
          Animated
        </label>
      </div>
      <div style="min-height:0;flex:1;border:1px solid var(--walli-border);border-radius:16px">
        <walli-chat
          ${ref((element) => {
            if (element?.localName === "walli-chat") chat = element as WalliChatElement;
          })}
          style="display:block;height:100%;width:100%;border-radius:inherit"
          .defaultScrollToBottom=${false}
          .messages=${messages}
        ></walli-chat>
      </div>
    </div>
  `;
}

function renderThemeToggle() {
  return html`
    <div
      data-theme-surface
      style="box-sizing:border-box;display:flex;height:520px;width:100%;flex-direction:column;gap:12px;padding:16px;background:var(--walli-background)"
    >
      <button
        type="button"
        aria-pressed="false"
        style="display:inline-flex;min-height:42px;cursor:pointer;align-items:center;align-self:flex-start;gap:9px;border:1px solid var(--walli-border);border-radius:12px;padding:0 16px;background:var(--walli-foreground);color:var(--walli-background);box-shadow:0 4px 12px rgb(0 0 0 / 0.12);font:600 14px sans-serif"
        @click=${(event: Event) => {
          const button = event.currentTarget as HTMLButtonElement;
          const surface = button.closest<HTMLElement>("[data-theme-surface]");
          const dark = button.getAttribute("aria-pressed") !== "true";
          const icon = button.querySelector<HTMLElement>("[data-theme-icon]");
          const label = button.querySelector<HTMLElement>("[data-theme-label]");

          button.setAttribute("aria-pressed", String(dark));
          if (icon) icon.textContent = dark ? "☀" : "☾";
          if (label) label.textContent = dark ? "Switch to light mode" : "Switch to dark mode";
          surface?.classList.toggle("dark", dark);
          if (surface) surface.style.colorScheme = dark ? "dark" : "light";
        }}
      >
        <span data-theme-icon aria-hidden="true" style="font-size:20px;line-height:1">☾</span>
        <span data-theme-label>Switch to dark mode</span>
      </button>
      <div style="min-height:0;flex:1;border:1px solid var(--walli-border);border-radius:16px">
        <walli-chat
          style="display:block;height:100%;width:100%;border-radius:inherit"
          .messages=${conversation}
        ></walli-chat>
      </div>
    </div>
  `;
}

function renderInsertMessages() {
  let chat: WalliChatElement | undefined;
  let stickInput: HTMLInputElement | undefined;
  let batch = 0;
  const messages = Array.from({ length: 20 }, (_, index): WalliChatMessage => ({
    id: `insert-initial-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    markdown:
      index % 2 === 0
        ? `Initial user message **#${index}**.`
        : `### Initial response #${index}\n\nThis is part of the original conversation.`,
  }));
  const buttonStyle =
    "cursor:pointer;border:1px solid var(--walli-border);border-radius:999px;background:var(--walli-card);color:var(--walli-card-foreground);padding:8px 14px;font:600 13px sans-serif";

  return html`
    <div
      style="box-sizing:border-box;display:flex;height:720px;width:100%;flex-direction:column;gap:12px;padding:16px;background:var(--walli-background)"
    >
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
        <button
          type="button"
          style=${buttonStyle}
          @click=${() => {
            if (!chat) return;
            const currentBatch = ++batch;
            chat.insertMessagesAtTop(
              [
                {
                  id: `insert-top-${currentBatch}-assistant`,
                  role: "assistant",
                  markdown: `### Older batch #${currentBatch}\n\nInserted at the top while preserving the visible reading position.`,
                },
                {
                  id: `insert-top-${currentBatch}-user`,
                  role: "user",
                  markdown: `Loaded older context from batch ${currentBatch}.`,
                },
              ],
              { stick: stickInput?.checked ?? false },
            );
          }}
        >
          Insert at top
        </button>
        <button
          type="button"
          style=${buttonStyle}
          @click=${() => {
            if (!chat) return;
            const currentBatch = ++batch;
            chat.insertMessagesAtBottom(
              [
                {
                  id: `insert-bottom-${currentBatch}-user`,
                  role: "user",
                  markdown: `New message from batch ${currentBatch}.`,
                },
                {
                  id: `insert-bottom-${currentBatch}-assistant`,
                  role: "assistant",
                  markdown: `### New response #${currentBatch}\n\nInserted at the bottom and kept in view.`,
                },
              ],
              { stick: stickInput?.checked ?? false },
            );
          }}
        >
          Insert at bottom
        </button>
        <label
          style="display:inline-flex;cursor:pointer;align-items:center;gap:7px;color:var(--walli-foreground);font:500 13px sans-serif"
        >
          <input
            ${ref((element) => {
              if (element instanceof HTMLInputElement) stickInput = element;
            })}
            type="checkbox"
            role="switch"
          />
          Stick
        </label>
      </div>
      <div style="min-height:0;flex:1;border:1px solid var(--walli-border);border-radius:16px">
        <walli-chat
          ${ref((element) => {
            if (element?.localName === "walli-chat") chat = element as WalliChatElement;
          })}
          style="display:block;height:100%;width:100%;border-radius:inherit"
          .messages=${messages}
        ></walli-chat>
      </div>
    </div>
  `;
}

function renderPaginationLoading(loadAtTop: boolean) {
  let chat: WalliChatElement | undefined;
  let page = 1;
  let generation = 0;

  const createPage = (pageNumber: number): WalliChatMessage[] =>
    Array.from({ length: 12 }, (_, index) => {
      const sequence = (pageNumber - 1) * 12 + index;
      return {
        id: `pagination-${generation}-${pageNumber}-${index}`,
        role: sequence % 2 === 0 ? "user" : "assistant",
        markdown:
          sequence % 2 === 0
            ? `Page ${pageNumber}, user message **#${sequence}**.`
            : `### Page ${pageNumber} response #${sequence}\n\nScroll to the active edge to load another page.`,
      };
    });

  const configure = () => {
    page = 1;
    generation++;
    if (!chat) return;
    chat.onEndReached = undefined;
    chat.defaultScrollToBottom = loadAtTop;
    chat.messages = createPage(page);
    chat.onEndReachedThreshold = 0.2;
    chat.onEndReached = async () => {
      if (!chat) return;
      const activeGeneration = generation;
      const loading: WalliChatMessage = {
        id: `pagination-loading-${activeGeneration}-${page + 1}`,
        role: "assistant",
        markdown: ":::loading-block\n:::",
        showActions: false,
      };
      const removeLoading = loadAtTop
        ? chat.insertMessagesAtTop([loading], { stick: true })
        : chat.insertMessagesAtBottom([loading], { stick: true });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
      if (!chat || activeGeneration !== generation) return;
      removeLoading();
      const nextPage = createPage(++page);
      if (loadAtTop) chat.insertMessagesAtTop(nextPage);
      else chat.insertMessagesAtBottom(nextPage);
    };
  };

  return html`
    <div
      style="box-sizing:border-box;display:flex;height:720px;width:100%;flex-direction:column;gap:12px;padding:16px;background:var(--walli-background)"
    >
      <div style="color:var(--walli-muted-foreground);font:500 13px sans-serif">
        ${
          loadAtTop
            ? "Start at bottom · scroll up to load older messages"
            : "Start at top · scroll down to load newer messages"
        }
      </div>
      <div style="min-height:0;flex:1;border:1px solid var(--walli-border);border-radius:16px">
        <walli-chat
          ${ref((element) => {
            if (element?.localName !== "walli-chat") return;
            chat = element as WalliChatElement;
            if (chat.dataset.paginationReady === "true") return;
            chat.dataset.paginationReady = "true";
            configure();
          })}
          style="display:block;height:100%;width:100%;border-radius:inherit"
        ></walli-chat>
      </div>
    </div>
  `;
}

function renderFullChat() {
  let chat: WalliChatElement | undefined;
  let composer: WalliChatComposerElement | undefined;
  let activeStream: WalliChatStreamingHandle | undefined;

  return html`
    <div style="height:720px;width:100%;background:var(--walli-background)">
      <walli-chat
        ${ref((element) => {
          if (element?.localName === "walli-chat") chat = element as WalliChatElement;
        })}
        style="display:block;height:100%;width:100%"
        .onFeedback=${() => undefined}
        .onReply=${() => undefined}
        .onShare=${() => undefined}
        .messages=${
          [
            {
              id: "full-chat-welcome",
              role: "assistant",
              markdown: [
                "## Welcome to Walli",
                "",
                "This story combines the message timeline with the complete Composer.",
                "",
                "- Send a message to see streaming Markdown",
                "- Add image or file attachments",
                "- Try the action menu",
                "- Allow microphone access to test transcription",
              ].join("\n"),
            },
          ] satisfies WalliChatMessage[]
        }
      >
        <walli-chat-composer
          ${ref((element) => {
            if (element?.localName === "walli-chat-composer") {
              composer = element as WalliChatComposerElement;
            }
          })}
          slot="composer"
          placeholder="Message Walli"
          .menuItems=${[
            { icon: Search, title: "Search the web", onClick: () => console.info("Search") },
            { icon: ImagePlus, title: "Insert image", onClick: () => console.info("Image") },
            {
              icon: FileSpreadsheet,
              title: "Insert spreadsheet",
              onClick: () => console.info("Spreadsheet"),
            },
          ]}
          .onUploadImages=${mockFullChatUpload}
          .onTranscribe=${mockFullChatTranscription}
          .onCancel=${() => activeStream?.abort(new DOMException("Cancelled", "AbortError"))}
          .onSubmit=${async (markdown: string) => {
            if (!chat || !composer || !markdown) return;
            chat.insertMessagesAtBottom(
              [{ id: `full-chat-user-${crypto.randomUUID()}`, role: "user", markdown }],
              { stick: true },
            );
            composer.value = "";
            activeStream = chat.insertStreamingMessageAtBottom(createStorySseStream(), {
              getToolLabel: (toolName) =>
                ({
                  web_search: "Searching the web",
                })[toolName] ?? toolName,
              messageId: `full-chat-assistant-${crypto.randomUUID()}`,
              stickToBottom: true,
            });
            try {
              await activeStream.finished;
            } finally {
              activeStream = undefined;
            }
          }}
        ></walli-chat-composer>
      </walli-chat>
    </div>
  `;
}

function createStorySseStream(): ReadableStream<string> {
  type StoryStreamRecord = {
    delay: number;
    event: "delta" | "start" | "tool-call" | "tool-result";
    data: unknown;
  };
  const records: StoryStreamRecord[] = [
    {
      delay: 200,
      event: "start",
      data: { model: "storybook/walli-stream-demo" },
    },
  ];

  const appendMarkdown = (markdown: string) => {
    for (const text of markdown.match(/[\s\S]{1,14}/g) ?? []) {
      records.push({ delay: 55, event: "delta", data: { text } });
    }
  };

  appendMarkdown(
    [
      "## Streaming analysis",
      "",
      "I’ll organize the response, then run one search before rendering the table.",
      "",
      "### Plan",
      "",
      "1. Inspect the conversation context",
      "   - Read recent messages",
      "   - Extract the user’s requirements",
      "     - Preserve streaming behavior",
      "     - Exercise nested block layout",
      "2. Search for supporting information",
      "3. Summarize the result in a table",
      "",
    ].join("\n"),
  );
  records.push(
    {
      delay: 250,
      event: "tool-call",
      data: {
        input: { query: "streaming Markdown tables and nested lists" },
        toolCallId: "storybook-web-search",
        toolName: "web_search",
      },
    },
    {
      delay: 2_000,
      event: "tool-result",
      data: {
        output: { results: 3 },
        toolCallId: "storybook-web-search",
        toolName: "web_search",
      },
    },
  );
  appendMarkdown(
    [
      "Search completed. Here is the result:",
      "",
      "| Capability | Stream phase | Result |",
      "| --- | --- | --- |",
      "| Nested lists | Partial Markdown | Stable indentation |",
      "| Tool calls | Waiting for result | Visible status block |",
      "| Tables | Final response | Incremental row rendering |",
      "| Cancellation | Any phase | Stream aborts safely |",
      "",
      "> The table itself arrives chunk by chunk, including temporarily incomplete rows.",
      "",
      "```ts",
      "const handle = chat.insertStreamingMessageAtBottom(stream, {",
      "  messageId: crypto.randomUUID(),",
      "  stickToBottom: true,",
      "});",
      "```",
      "",
      "The complex streaming demonstration is complete.",
    ].join("\n"),
  );
  let index = 0;

  return new ReadableStream<string>({
    async pull(controller) {
      if (index >= records.length) {
        controller.close();
        return;
      }
      const record = records[index++]!;
      await new Promise<void>((resolve) => window.setTimeout(resolve, record.delay));
      controller.enqueue(`event: ${record.event}\ndata: ${JSON.stringify(record.data)}\n\n`);
    },
  });
}

async function mockFullChatUpload(
  files: readonly File[],
  setProgress: (file: File, progress: number) => void,
  setResult: (file: File, result: { url: string } | { error: Error }) => void,
): Promise<void> {
  await Promise.all(
    files.map(
      (file) =>
        new Promise<void>((resolve) => {
          let progress = 0;
          const timer = window.setInterval(() => {
            progress = Math.min(100, progress + 12);
            setProgress(file, progress);
            if (progress === 100) {
              window.clearInterval(timer);
              setResult(file, { url: URL.createObjectURL(file) });
              resolve();
            }
          }, 160);
        }),
    ),
  );
}

async function mockFullChatTranscription({
  stream,
  finished,
  signal,
}: WalliChatComposerTranscriptionContext): Promise<string> {
  await stream;
  await finished;
  if (signal.aborted) throw signal.reason;
  await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
  return "Please demonstrate the streaming response.";
}
