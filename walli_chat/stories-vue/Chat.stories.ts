import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { FileSpreadsheet, ImagePlus, Search } from "lucide";
import { defineComponent, h, nextTick, onMounted, ref } from "vue";
import {
  WalliChat,
  WalliChatComposer,
  registerBlock,
  type WalliChatExpose,
  type WalliChatMessage,
  type WalliChatStreamingHandle,
} from "../src/vue";
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
import { fullChatWelcomeMessages } from "../stories-react/full-chat-data";
import { createReasoningStorySseStream, createStorySseStream } from "../stories-react/story-stream";
import { chatSource, source } from "./source";

type Args = { messages: WalliChatMessage[] };
const style = { display: "block", height: "100%", width: "100%" };
const buttonStyle = {
  cursor: "pointer",
  border: "1px solid var(--walli-border)",
  borderRadius: "999px",
  background: "var(--walli-card)",
  color: "var(--walli-card-foreground)",
  padding: "8px 14px",
  font: "600 13px sans-serif",
};
const component = (name: string, setup: () => () => ReturnType<typeof h>) =>
  defineComponent({ name, setup });
const render = (demo: object) => () => ({ components: { Demo: demo }, template: `<Demo />` });
const frame = (children: ReturnType<typeof h>[]) =>
  h(
    "div",
    {
      style: {
        boxSizing: "border-box",
        display: "flex",
        height: "720px",
        width: "100%",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
        background: "var(--walli-background)",
      },
    },
    children,
  );
const panel = (child: ReturnType<typeof h>) =>
  h(
    "div",
    {
      style: {
        minHeight: 0,
        flex: 1,
        border: "1px solid var(--walli-border)",
        borderRadius: "16px",
      },
    },
    [child],
  );
const button = (label: string, onClick: () => void) =>
  h("button", { style: buttonStyle, onClick }, label);

const ChatSurface = defineComponent({
  props: { compact: Boolean, messages: { required: true, type: Array } },
  setup: (props) => () =>
    h("div", { style: { height: props.compact ? "240px" : "640px", width: "100%" } }, [
      h(WalliChat, {
        messages: props.messages,
        style,
        onFeedback: (id: string, _markdown: string, feedback: string) =>
          console.info("Feedback", { id, feedback }),
        onReply: (id: string) => console.info("Reply", { id }),
        onShare: (id: string) => console.info("Share", { id }),
      }),
    ]),
});

const meta = {
  title: "Vue/Chat",
  component: WalliChat,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Vue versions of every walli-chat demo." } },
  },
  args: { messages: conversation },
  render: (args) => ({
    components: { ChatSurface },
    setup: () => ({ args }),
    template: `<ChatSurface v-bind="args" />`,
  }),
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;

const ReplaceBlockDemo = component("ReplaceBlockDemo", () => {
  const chat = ref<WalliChatExpose>();
  onMounted(async () => {
    await nextTick();
    const element = chat.value?.element;
    if (!element) return;
    const registration = registerBlock(replaceToolCallBlockDefinition);
    try {
      element.messages = replaceBlockMessage;
    } finally {
      registration.unregister();
    }
  });
  return () =>
    h("div", { style: { height: "320px" } }, [h(WalliChat, { ref: chat, messages: [], style })]);
});
const ThemeToggleDemo = component("ThemeToggleDemo", () => {
  const dark = ref(false);
  return () =>
    h(
      "div",
      {
        class: dark.value ? "dark" : undefined,
        style: {
          boxSizing: "border-box",
          display: "flex",
          height: "520px",
          flexDirection: "column",
          gap: "12px",
          padding: "16px",
          colorScheme: dark.value ? "dark" : "light",
          background: "var(--walli-background)",
        },
      },
      [
        button(
          dark.value ? "☀ Switch to light mode" : "☾ Switch to dark mode",
          () => (dark.value = !dark.value),
        ),
        panel(h(WalliChat, { messages: conversation, style })),
      ],
    );
});

const scrollMessages: WalliChatMessage[] = Array.from({ length: 40 }, (_, index) => ({
  id: `vue-scroll-${index}`,
  role: index % 2 ? "assistant" : "user",
  markdown:
    index % 2
      ? `### Response #${index}\n\nThis message adds enough content to make the conversation scrollable.`
      : `Message **#${index}**: navigate to this item using the index control.`,
}));
const ScrollControlsDemo = component("ScrollControlsDemo", () => {
  const chat = ref<WalliChatExpose>();
  const index = ref(20);
  const animated = ref(true);
  return () =>
    frame([
      h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" } }, [
        button("Scroll to top", () =>
          chat.value?.scrollTo({ target: "top", animated: animated.value }),
        ),
        button("Scroll to bottom", () =>
          chat.value?.scrollTo({ target: "bottom", animated: animated.value }),
        ),
        h("input", {
          type: "number",
          min: 0,
          max: 39,
          value: index.value,
          style: { width: "100px", padding: "8px" },
          onInput: (e: Event) => (index.value = Number((e.target as HTMLInputElement).value)),
        }),
        button("Scroll to index", () =>
          chat.value?.scrollToIndex({ index: index.value, animated: animated.value }),
        ),
        h("label", [
          h("input", {
            type: "checkbox",
            checked: animated.value,
            onChange: (e: Event) => (animated.value = (e.target as HTMLInputElement).checked),
          }),
          " Animated",
        ]),
      ]),
      panel(
        h(WalliChat, { ref: chat, defaultScrollToBottom: false, messages: scrollMessages, style }),
      ),
    ]);
});

const initialMessages: WalliChatMessage[] = Array.from({ length: 20 }, (_, index) => ({
  id: `vue-insert-${index}`,
  role: index % 2 ? "assistant" : "user",
  markdown:
    index % 2
      ? `### Initial response #${index}\n\nThis is part of the original conversation.`
      : `Initial user message **#${index}**.`,
}));
const InsertMessagesDemo = component("InsertMessagesDemo", () => {
  const chat = ref<WalliChatExpose>();
  const batch = ref(0);
  const stick = ref(false);
  const insert = (top: boolean) => {
    const n = ++batch.value;
    const messages: WalliChatMessage[] = top
      ? [
          {
            id: `vue-top-a-${n}`,
            role: "assistant",
            markdown: `### Older batch #${n}\n\nInserted at the top.`,
          },
          { id: `vue-top-u-${n}`, role: "user", markdown: `Loaded older context from batch ${n}.` },
        ]
      : [
          { id: `vue-bottom-u-${n}`, role: "user", markdown: `New message from batch ${n}.` },
          {
            id: `vue-bottom-a-${n}`,
            role: "assistant",
            markdown: `### New response #${n}\n\nInserted at the bottom.`,
          },
        ];
    top
      ? chat.value?.insertMessagesAtTop(messages, { stick: stick.value })
      : chat.value?.insertMessagesAtBottom(messages, { stick: stick.value });
  };
  return () =>
    frame([
      h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" } }, [
        button("Insert at top", () => insert(true)),
        button("Insert at bottom", () => insert(false)),
        h(
          "label",
          {
            style: {
              display: "inline-flex",
              cursor: "pointer",
              alignItems: "center",
              gap: "7px",
              color: "var(--walli-foreground)",
              font: "500 13px sans-serif",
            },
          },
          [
            h("input", {
              type: "checkbox",
              checked: stick.value,
              onChange: (e: Event) => (stick.value = (e.target as HTMLInputElement).checked),
            }),
            "Stick",
          ],
        ),
      ]),
      panel(h(WalliChat, { ref: chat, messages: initialMessages, style })),
    ]);
});

const PaginationDemo = defineComponent({
  props: { loadAtTop: Boolean },
  setup(props) {
    const chat = ref<WalliChatExpose>();
    let page = 1;
    let loading = false;
    const createPage = (p: number): WalliChatMessage[] =>
      Array.from({ length: 12 }, (_, index) => {
        const n = (p - 1) * 12 + index;
        return {
          id: `vue-page-${p}-${index}`,
          role: n % 2 ? "assistant" : "user",
          markdown:
            n % 2
              ? `### Page ${p} response #${n}\n\nScroll to the active edge to load another page.`
              : `Page ${p}, user message **#${n}**.`,
        };
      });
    const reached = async () => {
      if (!chat.value || loading) return;
      loading = true;
      const indicator: WalliChatMessage = {
        id: `vue-loading-${page + 1}`,
        role: "assistant",
        markdown: ":::loading-block\n:::",
        showActions: false,
      };
      const remove = props.loadAtTop
        ? chat.value.insertMessagesAtTop([indicator], { stick: true })
        : chat.value.insertMessagesAtBottom([indicator], { stick: true });
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
      remove();
      const next = createPage(++page);
      props.loadAtTop
        ? chat.value.insertMessagesAtTop(next)
        : chat.value.insertMessagesAtBottom(next);
      loading = false;
    };
    return () =>
      frame([
        h(
          "div",
          { style: { color: "var(--walli-muted-foreground)", font: "500 13px sans-serif" } },
          props.loadAtTop
            ? "Start at bottom · scroll up to load older messages"
            : "Start at top · scroll down to load newer messages",
        ),
        panel(
          h(WalliChat, {
            ref: chat,
            defaultScrollToBottom: props.loadAtTop,
            messages: createPage(1),
            onEndReached: reached,
            onEndReachedThreshold: 0.2,
            style,
          }),
        ),
      ]);
  },
});

const FullChatDemo = component(
  "FullChatDemo",
  (props: { mode: "bottomPadding" | "stickToBottom" }) => {
    const chat = ref<WalliChatExpose>();
    const value = ref("");
    let active: WalliChatStreamingHandle | undefined;
    const submit = async (markdown: string) => {
      if (!chat.value || !markdown) return;
      chat.value.insertMessagesAtBottom(
        [{ id: `vue-user-${crypto.randomUUID()}`, role: "user", markdown }],
        { stick: true },
      );
      value.value = "";
      const commonOptions = {
        getToolLabel: (name) => ({ web_search: "Searching the web" })[name] ?? name,
        messageId: `vue-assistant-${crypto.randomUUID()}`,
      };
      active = chat.value.insertStreamingMessageAtBottom(
        createStorySseStream(),
        props.mode === "bottomPadding"
          ? {
              ...commonOptions,
              bottomPaddingHeight: ((chat.value.element?.clientHeight ?? 720) * 2) / 3,
            }
          : { ...commonOptions, stickToBottom: true },
      );
      try {
        await active.finished;
      } finally {
        active = undefined;
      }
    };
    return () =>
      h("div", { style: { height: "720px", width: "100%" } }, [
        h(
          WalliChat,
          { ref: chat, messages: fullChatWelcomeMessages, style },
          {
            default: () =>
              h(WalliChatComposer, {
                slot: "composer",
                placeholder: "Message Walli",
                value: value.value,
                "onUpdate:value": (next: string) => (value.value = next),
                menuItems: [
                  { icon: Search, title: "Search the web", onClick: () => console.info("Search") },
                  { icon: ImagePlus, title: "Insert image", onClick: () => console.info("Image") },
                  {
                    icon: FileSpreadsheet,
                    title: "Insert spreadsheet",
                    onClick: () => console.info("Spreadsheet"),
                  },
                ],
                onUploadImages: mockFullChatUpload,
                onTranscribe: mockFullChatTranscription,
                onCancel: () => active?.abort(new DOMException("Cancelled", "AbortError")),
                onSubmit: submit,
              }),
          },
        ),
      ]);
  },
);

const ReasoningStreamDemo = component("ReasoningStreamDemo", () => {
  const chat = ref<WalliChatExpose>();
  const running = ref(false);
  const messages: WalliChatMessage[] = [
    {
      id: "vue-reasoning-prompt",
      role: "user",
      markdown: "Explain how reasoning differs from the final answer.",
    },
  ];

  const start = async () => {
    if (!chat.value || running.value) return;
    running.value = true;
    try {
      await chat.value.insertStreamingMessageAtBottom(createReasoningStorySseStream(), {
        getToolLabel: (name) => (name === "web_search" ? "Searching the web" : name),
        messageId: `vue-reasoning-${crypto.randomUUID()}`,
        reasoningLabels: { thinking: "Thinking", thought: "Thought" },
        stickToBottom: true,
      }).finished;
    } finally {
      running.value = false;
    }
  };

  return () =>
    frame([
      h(
        "button",
        {
          disabled: running.value,
          onClick: start,
          style: { ...buttonStyle, alignSelf: "flex-start" },
        },
        "Start reasoning stream",
      ),
      panel(h(WalliChat, { ref: chat, messages, style })),
    ]);
});

const fullChatCode = `<script setup lang="ts">
import { ref } from "vue";
import { FileSpreadsheet, ImagePlus, Search } from "lucide";
import { WalliChat, WalliChatComposer } from "@wallilabs/chat/vue";
import { createStorySseStream } from "./story-stream";

const chat = ref();
const value = ref("");
let activeStream;
const menuItems = [
  { icon: Search, title: "Search the web", onClick: () => console.log("Search") },
  { icon: ImagePlus, title: "Insert image", onClick: () => console.log("Insert image") },
  {
    icon: FileSpreadsheet,
    title: "Insert spreadsheet",
    onClick: () => console.log("Insert spreadsheet"),
  },
];

async function uploadImages(files, setProgress, setResult) {
  for (const file of files) {
    setProgress(file, 100);
    setResult(file, { url: URL.createObjectURL(file) });
  }
}

async function transcribe({ stream, finished }) {
  await stream;
  const { audio } = await finished;
  console.log("Recorded bytes", audio.size);
  return "This is a simulated transcription returned by Storybook.";
}

async function submit(markdown: string) {
  if (!markdown) return;
  chat.value.insertMessagesAtBottom(
    [{ id: crypto.randomUUID(), role: "user", markdown }],
    { stick: true },
  );
  value.value = "";
  activeStream = chat.value.insertStreamingMessageAtBottom(
    createStorySseStream(),
    { messageId: crypto.randomUUID(), stickToBottom: true },
  );
  await activeStream.finished;
}
</script>

<template>
  <WalliChat ref="chat" :messages="welcomeMessages" style="height: 720px">
    <WalliChatComposer
      v-model:value="value"
      slot="composer"
      upload-images-title="Add files"
      :menu-items="menuItems"
      :on-upload-images="uploadImages"
      :on-transcribe="transcribe"
      @cancel="activeStream?.abort()"
      @submit="submit"
    />
  </WalliChat>
</template>`;

const reasoningStreamCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChat } from "@wallilabs/chat/vue";
import { createReasoningStorySseStream } from "./story-stream";

const chat = ref();
const running = ref(false);

async function start() {
  if (!chat.value || running.value) return;
  running.value = true;
  try {
    await chat.value.insertStreamingMessageAtBottom(
      createReasoningStorySseStream(),
      {
        messageId: crypto.randomUUID(),
        reasoningLabels: { thinking: "Thinking", thought: "Thought" },
        stickToBottom: true,
      },
    ).finished;
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <button :disabled="running" @click="start">Start reasoning stream</button>
  <WalliChat ref="chat" :messages="[]" style="height: 560px" />
</template>`;

const customBlockCode = `<script setup lang="ts">
import { onUnmounted } from "vue";
import {
  WalliChat,
  registerBlock,
  type WalliChatMessage,
} from "@wallilabs/chat/vue";
import { noticeBlockDefinition } from "./notice-block";
import "@wallilabs/chat/theme.css";

const messages: WalliChatMessage[] = ${JSON.stringify(customBlockMessage, null, 2)};

const registration = registerBlock(noticeBlockDefinition);
onUnmounted(() => registration.unregister());
</script>

<template>
  <WalliChat :messages="messages" style="height: 640px" />
</template>`;

const replaceBlockCode = `<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { WalliChat, registerBlock } from "@wallilabs/chat/vue";
import { replacementBlockDefinition } from "./replacement-block";
import "@wallilabs/chat/theme.css";

const chat = ref();

onMounted(async () => {
  await nextTick();
  const registration = registerBlock(replacementBlockDefinition);
  try {
    chat.value.element.messages = ${JSON.stringify(replaceBlockMessage, null, 2)};
  } finally {
    registration.unregister();
  }
});
</script>

<template>
  <WalliChat ref="chat" :messages="[]" style="height: 320px" />
</template>`;

const themeToggleCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChat } from "@wallilabs/chat/vue";
import "@wallilabs/chat/theme.css";

const dark = ref(false);
</script>

<template>
  <div
    :class="{ dark }"
    :style="{ colorScheme: dark ? 'dark' : 'light' }"
  >
    <button type="button" @click="dark = !dark">
      {{ dark ? "Switch to light mode" : "Switch to dark mode" }}
    </button>
    <WalliChat :messages="messages" style="height: 480px" />
  </div>
</template>`;

const scrollControlsCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChat, type WalliChatMessage } from "@wallilabs/chat/vue";

const chat = ref();
const index = ref(20);
const animated = ref(true);
const messages: WalliChatMessage[] = Array.from(
  { length: 40 },
  (_, index) => ({
    id: String(index),
    role: index % 2 ? "assistant" : "user",
    markdown: \`Message #\${index}\`,
  }),
);
</script>

<template>
  <button @click="chat.scrollTo({ target: 'top', animated })">
    Scroll to top
  </button>
  <button @click="chat.scrollTo({ target: 'bottom', animated })">
    Scroll to bottom
  </button>
  <input v-model.number="index" type="number" :min="0" :max="39" />
  <button @click="chat.scrollToIndex({ index, animated })">
    Scroll to index
  </button>
  <label><input v-model="animated" type="checkbox" /> Animated</label>
  <WalliChat
    ref="chat"
    :default-scroll-to-bottom="false"
    :messages="messages"
    style="height: 640px"
  />
</template>`;

const insertMessagesCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChat } from "@wallilabs/chat/vue";

const chat = ref();
const stick = ref(false);
let batch = 0;

function insertAtTop() {
  batch += 1;
  chat.value.insertMessagesAtTop(
    [{ id: \`top-\${batch}\`, role: "assistant", markdown: "Older message" }],
    { stick: stick.value },
  );
}

function insertAtBottom() {
  batch += 1;
  chat.value.insertMessagesAtBottom(
    [{ id: \`bottom-\${batch}\`, role: "user", markdown: "New message" }],
    { stick: stick.value },
  );
}
</script>

<template>
  <button @click="insertAtTop">Insert at top</button>
  <button @click="insertAtBottom">Insert at bottom</button>
  <label><input v-model="stick" type="checkbox" /> Stick</label>
  <WalliChat ref="chat" :messages="initialMessages" style="height: 640px" />
</template>`;

function paginationCode(loadAtTop: boolean) {
  const method = loadAtTop ? "insertMessagesAtTop" : "insertMessagesAtBottom";
  return `<script setup lang="ts">
import { ref } from "vue";
import { WalliChat } from "@wallilabs/chat/vue";

const chat = ref();
let loading = false;

async function onEndReached() {
  if (loading) return;
  loading = true;
  const removeLoading = chat.value.${method}(
    [{ id: crypto.randomUUID(), role: "assistant", markdown: ":::loading-block\\n:::" }],
    { stick: true },
  );
  const nextPage = await loadNextPage();
  removeLoading();
  chat.value.${method}(nextPage);
  loading = false;
}
</script>

<template>
  <WalliChat
    ref="chat"
    :default-scroll-to-bottom="${loadAtTop}"
    :messages="initialPage"
    :on-end-reached-threshold="0.2"
    :on-end-reached="onEndReached"
    style="height: 640px"
  />
</template>`;
}

export const FullChatBottomPadding: Story = {
  render: render(FullChatDemo, { mode: "bottomPadding" }),
  parameters: source(
    fullChatCode.replace(
      "{ messageId: crypto.randomUUID(), stickToBottom: true },",
      `{\n      messageId: crypto.randomUUID(),\n      bottomPaddingHeight: ((chat.value.element?.clientHeight ?? 720) * 2) / 3,\n    },`,
    ),
  ),
};
export const FullChatStickToBottom: Story = {
  render: render(FullChatDemo, { mode: "stickToBottom" }),
  parameters: source(fullChatCode),
};
export const ReasoningStream: Story = {
  render: render(ReasoningStreamDemo),
  parameters: source(reasoningStreamCode),
};
export const Conversation: Story = { parameters: source(chatSource(conversation)) };
export const RichMarkdown: Story = {
  args: { messages: markdownShowcase },
  parameters: source(chatSource(markdownShowcase)),
};
export const UserMessage: Story = {
  args: { messages: userMessage },
  render: (args) => ({
    components: { ChatSurface },
    setup: () => ({ args }),
    template: `<ChatSurface v-bind="args" compact />`,
  }),
  parameters: source(chatSource(userMessage, 240)),
};
export const AssistantMessage: Story = {
  args: { messages: assistantMessage },
  render: (args) => ({
    components: { ChatSurface },
    setup: () => ({ args }),
    template: `<ChatSurface v-bind="args" compact />`,
  }),
  parameters: source(chatSource(assistantMessage, 240)),
};
export const ImageMessage: Story = {
  args: { messages: imageMessage },
  parameters: source(chatSource(imageMessage)),
};
export const CustomBlock: Story = {
  args: { messages: customBlockMessage },
  parameters: source(customBlockCode),
};
export const RepalceBlock: Story = {
  render: render(ReplaceBlockDemo),
  parameters: source(replaceBlockCode),
};
export const ThemeToggle: Story = {
  render: render(ThemeToggleDemo),
  parameters: source(themeToggleCode),
};
export const ScrollControls: Story = {
  render: render(ScrollControlsDemo),
  parameters: source(scrollControlsCode),
};
export const InsertMessages: Story = {
  render: render(InsertMessagesDemo),
  parameters: source(insertMessagesCode),
};
export const LoadOlderAtTop: Story = {
  render: () => ({ components: { PaginationDemo }, template: `<PaginationDemo load-at-top />` }),
  parameters: source(paginationCode(true)),
};
export const LoadNewerAtBottom: Story = {
  render: render(PaginationDemo),
  parameters: source(paginationCode(false)),
};
