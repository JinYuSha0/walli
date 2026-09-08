import type { Meta, StoryObj } from "@storybook/vue3-vite";
import {
  FileSpreadsheet,
  ImagePlus,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  type IconNode,
} from "lucide";
import { defineComponent, h, nextTick, onMounted, ref, watch, type PropType } from "vue";
import { html } from "lit";
import {
  WalliChat,
  WalliChatComposer,
  registerBlock,
  type WalliChatAction,
  type WalliChatEditActionData,
  type WalliChatExpose,
  type WalliChatMessage,
  type WalliChatStreamingHandle,
} from "../src/vue";
import {
  assistantMessage,
  actionMessages,
  conversation,
  createTimeMessages,
  customBlockMessage,
  imageMessage,
  initialIndexMessages,
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

type Args = InstanceType<typeof WalliChat>["$props"];
const style = { display: "block", height: "100%", width: "100%" };
const timeFormatter = (createdAt: number) => new Date(createdAt).toLocaleString();
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
const render = (demo: object, props?: Record<string, unknown>) => () => ({
  components: { Demo: demo },
  setup: () => ({ props }),
  template: props ? `<Demo v-bind="props" />` : `<Demo />`,
});
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
  inheritAttrs: false,
  props: {
    compact: Boolean,
    intervalSeconds: { default: 0, type: Number },
    messages: {
      required: true,
      type: Array as PropType<readonly WalliChatMessage[]>,
    },
    timeFormatter: Function as PropType<(createdAt: number) => string>,
  },
  setup:
    (props, { attrs }) =>
    () =>
      h("div", { style: { height: props.compact ? "240px" : "640px", width: "100%" } }, [
        h(WalliChat, {
          ...attrs,
          intervalSeconds: props.intervalSeconds,
          messages: props.messages,
          style,
          timeFormatter: props.timeFormatter,
        } as Args),
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
  argTypes: {
    responsive: {
      control: "select",
      options: ["auto", "base", "sm", "md", "lg", "xl", "2xl"],
      mapping: { auto: undefined },
      description:
        "Shared global breakpoint. Auto uses viewport media queries; changing the prop relayouts this chat.",
    },

    actionConfig: {
      control: "object",
      table: {
        type: {
          summary: "WalliChatActionConfig",
          detail:
            "ActionItem = boolean | { visible: boolean; sort?: number }\nCustomAction = { type: string; icon?: IconNode; component?: (context) => unknown; label?: string; visible: boolean; sort?: number }\nAssistant = { copy?: ActionItem; feedback?: ActionItem; share?: ActionItem; [name: string]: ActionItem | CustomAction | undefined }\nUser = { copy?: ActionItem; edit?: ActionItem; [name: string]: ActionItem | CustomAction | undefined }",
        },
      },
    },
    bottomOcclusionHeight: { control: "number" },
    class: { control: "text" },
    defaultScrollToBottom: { control: "boolean" },
    defaultScrollToIndex: { control: "number" },
    intervalSeconds: { control: { min: 0, step: 60, type: "number" } },
    loading: { control: "boolean" },
    messages: { control: "object" },
    onAction: { control: false },
    onEndReached: { control: false },
    onEndReachedThreshold: { control: "number" },
    style: { control: "object" },
    timeFormatter: { control: false },
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

const InitialIndexDemo = component(
  "InitialIndexDemo",
  () => () =>
    h("div", { style: { height: "640px", width: "100%" } }, [
      h(WalliChat, {
        defaultScrollToIndex: 8,
        intervalSeconds: 6 * 60 * 60,
        messages: initialIndexMessages,
        style,
      }),
    ]),
);

const initialMessages: WalliChatMessage[] = Array.from({ length: 20 }, (_, index) => ({
  id: `vue-insert-${index}`,
  role: index % 2 ? "assistant" : "user",
  markdown:
    index % 2
      ? `### Initial response #${index}\n\nThis is part of the original conversation.`
      : `Initial user message **#${index}**.`,
}));
const ResponsiveDemo = defineComponent({
  props: { responsive: String as PropType<Args["responsive"]> },
  setup(props) {
    const selected = ref(props.responsive);
    watch(
      () => props.responsive,
      (value) => {
        selected.value = value;
      },
    );
    return () =>
      frame([
        h("p", "The breakpoint is shared globally. Auto uses the viewport width."),
        h(
          "div",
          {
            role: "group",
            "aria-label": "Responsive breakpoint",
            style: { display: "flex", flexWrap: "wrap", gap: "8px" },
          },
          (["auto", "base", "sm", "md", "lg", "xl", "2xl"] as const).map((value) =>
            h(
              "button",
              {
                style: buttonStyle,
                "aria-pressed": (selected.value ?? "auto") === value,
                onClick: () => {
                  selected.value = value === "auto" ? undefined : value;
                },
              },
              value,
            ),
          ),
        ),
        panel(
          h(WalliChat, { responsive: selected.value, messages: conversation.slice(0, 2), style }),
        ),
      ]);
  },
});

const animatedInsertButton = (getChat: () => WalliChatExpose | undefined) =>
  button("Insert with animation", () => {
    getChat()?.insertMessagesAtBottom(
      [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          markdown:
            "An update has arrived. Here is some additional information for our conversation.",
        },
      ],
      { animation: "slide-in", waitForStreaming: true, stick: true },
    );
  });

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
      animatedInsertButton(() => chat.value),
      panel(h(WalliChat, { ref: chat, messages: initialMessages, style })),
    ]);
});

const ReplaceMessageDemo = component("ReplaceMessageDemo", () => {
  const chat = ref<WalliChatExpose>();
  let version = 1;
  let messageId = "vue-replace-1";
  const messages: WalliChatMessage[] = [
    { id: messageId, role: "assistant", markdown: "## Vue message 1" },
  ];
  const replace = () => {
    const nextVersion = version + 1;
    const nextId = `vue-replace-${nextVersion}`;
    if (
      chat.value?.replaceMessage(messageId, {
        id: nextId,
        markdown: `## Vue message ${nextVersion}\n\nReplaced in place.`,
      })
    ) {
      version = nextVersion;
      messageId = nextId;
    }
  };
  return () =>
    frame([
      button("Replace message", replace),
      panel(h(WalliChat, { ref: chat, messages, style })),
    ]);
});

const apiDemoMessages: WalliChatMessage[] = [
  { id: "vue-api-user-1", role: "user", markdown: "Keep this message." },
  { id: "vue-api-assistant-1", role: "assistant", markdown: "This reply can be deleted." },
  { id: "vue-api-user-2", role: "user", markdown: "This message can also be deleted." },
];
const DeleteMessagesDemo = component("DeleteMessagesDemo", () => {
  const chat = ref<WalliChatExpose>();
  const messages = ref<readonly WalliChatMessage[]>(apiDemoMessages);
  const status = ref("Ready");
  const deleteMessages = () => {
    const deletedCount = chat.value?.deleteMessages(["vue-api-assistant-1", "vue-api-user-2"]) ?? 0;
    status.value = `Deleted ${deletedCount} messages`;
  };
  const reset = () => {
    messages.value = [...apiDemoMessages];
    status.value = "Ready";
  };
  return () =>
    frame([
      h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
        button("Delete two messages", deleteMessages),
        button("Reset", reset),
        h(
          "span",
          {
            "aria-live": "polite",
            style: { color: "var(--walli-muted-foreground)", font: "500 13px sans-serif" },
          },
          status.value,
        ),
      ]),
      panel(h(WalliChat, { ref: chat, messages: messages.value, style })),
    ]);
});

type EditMessageDemoAction = WalliChatAction<{}, { "edit-block": WalliChatEditActionData }>;

const EditMessageDemo = component("EditMessageDemo", () => {
  const chat = ref<WalliChatExpose>();
  const messages: WalliChatMessage[] = [
    { id: "vue-edit-user", role: "user", markdown: "Please explain CSS gird." },
    { id: "vue-edit-assistant", role: "assistant", markdown: "CSS Grid is a layout system." },
  ];
  const handleAction = async (action: EditMessageDemoAction) => {
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
  };
  return () =>
    h("div", { style: { height: "640px" } }, [
      h(
        WalliChat,
        {
          ref: chat,
          actionConfig: { user: { edit: { visible: true, sort: 2 } } },
          messages,
          onAction: handleAction,
          style,
        },
        {
          default: () =>
            h(WalliChatComposer, {
              slot: "composer",
              value: "",
              onSubmit: async (markdown: string) => {
                chat.value?.insertMessagesAtBottom([
                  { id: crypto.randomUUID(), role: "user", markdown },
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    markdown: "Updated response.",
                  },
                ]);
              },
            }),
        },
      ),
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

const FullChatDemo = defineComponent({
  name: "FullChatDemo",
  props: {
    mode: {
      required: true,
      type: String as PropType<"bottomPadding" | "stickToBottom">,
    },
  },
  setup(props) {
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
        getToolLabel: (name: string) =>
          ({ web_search: "Searching the web" })[name as "web_search"] ?? name,
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
});

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

const timeMessagesCode = `<script setup lang="ts">
import { WalliChat, type WalliChatMessage } from "@wallilabs/chat/vue";
import "@wallilabs/chat/theme.css";

const now = Date.now();
const messages: WalliChatMessage[] = [
  { id: "time-user-1", role: "user", markdown: "First message", createdAt: now - 20 * 60_000 },
  { id: "time-assistant-1", role: "assistant", markdown: "First reply", createdAt: now - 19 * 60_000 },
  { id: "time-user-2", role: "user", markdown: "Twelve minutes after the previous user message", createdAt: now - 8 * 60_000 },
];

const formatTime = (createdAt: number) => new Date(createdAt).toLocaleString();
</script>

<template>
  <WalliChat
    :interval-seconds="10 * 60"
    :messages="messages"
    :time-formatter="formatTime"
    style="height: 640px"
  />
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
import {
  WalliChat,
  type WalliChatExpose,
  type WalliChatMessage,
} from "@wallilabs/chat/vue";
import "@wallilabs/chat/theme.css";

const chat = ref<WalliChatExpose>();
const stick = ref(false);
const initialMessages: WalliChatMessage[] = Array.from(
  { length: 20 },
  (_, i) => ({
    id: "initial-" + i,
    role: i % 2 === 0 ? "user" : "assistant",
    markdown: "Initial message " + (i + 1),
  }),
);

function insert(top: boolean) {
  const messages: WalliChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      markdown: top ? "Older message" : "New message",
    },
  ];
  if (top) chat.value?.insertMessagesAtTop(messages, { stick: stick.value });
  else chat.value?.insertMessagesAtBottom(messages, { stick: stick.value });
}

function insertAnimated() {
  chat.value?.insertMessagesAtBottom(
    [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        markdown:
          "An update has arrived. Here is some additional information for our conversation.",
      },
    ],
    { animation: "slide-in", waitForStreaming: true, stick: true },
  );
  // If a stream is active, insertion waits until it settles.
}
</script>

<template>
  <button @click="insert(true)">Insert at top</button>
  <button @click="insert(false)">Insert at bottom</button>
  <label
    ><input
      v-model="stick"
      type="checkbox"
    />
    Stick</label
  >
  <button @click="insertAnimated">Insert with animation</button>
  <WalliChat
    ref="chat"
    :messages="initialMessages"
    style="display: block; height: 640px"
  />
</template>`;

const responsiveCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChat, type WalliChatMessage } from "@wallilabs/chat/vue";
import "@wallilabs/chat/theme.css";

const options = ["auto", "base", "sm", "md", "lg", "xl", "2xl"] as const;
const responsive = ref<InstanceType<typeof WalliChat>["$props"]["responsive"]>("xl");
const messages: WalliChatMessage[] = [
  { id: "user", role: "user", markdown: "How does responsive layout work?" },
  { id: "assistant", role: "assistant", markdown: "Switch breakpoints to compare message spacing and bubble widths." },
];
</script>

<template>
  <p>The breakpoint is shared globally. Auto uses the viewport width.</p>
  <div role="group" aria-label="Responsive breakpoint">
    <button v-for="value in options" :key="value" :aria-pressed="(responsive ?? 'auto') === value"
      @click="responsive = value === 'auto' ? undefined : value">{{ value }}</button>
  </div>
  <WalliChat :responsive="responsive" :messages="messages" style="display:block;height:640px" />
</template>`;

const initialIndexCode = `<script setup lang="ts">
import { WalliChat } from "@wallilabs/chat/vue";

const messages = [
  { id: "day-1-user", role: "user", markdown: "Day 1", createdAt: Date.UTC(2026, 7, 24, 9) },
  { id: "day-1-reply", role: "assistant", markdown: "First reply", createdAt: Date.UTC(2026, 7, 24, 9, 15) },
  // Additional messages from day 2 and day 3...
];
</script>

<template>
  <WalliChat
    :default-scroll-to-index="8"
    :interval-seconds="6 * 60 * 60"
    :messages="messages"
    style="height: 640px"
  />
</template>`;

const replaceMessageCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChat } from "@wallilabs/chat/vue";

const chat = ref();
let version = 1;
let messageId = "message-1";
const messages = [
  { id: messageId, role: "assistant", markdown: "## Message 1" },
];

function replace() {
  const nextVersion = version + 1;
  const nextId = \`message-\${nextVersion}\`;
  if (chat.value.replaceMessage(messageId, {
    id: nextId,
    markdown: \`## Message \${nextVersion}\`,
  })) {
    version = nextVersion;
    messageId = nextId;
  }
}
</script>

<template>
  <button @click="replace">Replace message</button>
  <WalliChat ref="chat" :messages="messages" style="height: 640px" />
</template>`;

const deleteMessagesCode = `<script setup lang="ts">
import { ref } from "vue";
import { WalliChat, type WalliChatExpose, type WalliChatMessage } from "@wallilabs/chat/vue";

const chat = ref<WalliChatExpose>();
const initialMessages: WalliChatMessage[] = [
  { id: "user-1", role: "user", markdown: "Keep this message." },
  { id: "assistant-1", role: "assistant", markdown: "This reply can be deleted." },
  { id: "user-2", role: "user", markdown: "This message can also be deleted." },
];
const messages = ref<readonly WalliChatMessage[]>(initialMessages);

function reset() {
  messages.value = [...initialMessages];
}
</script>

<template>
  <button @click="chat?.deleteMessages(['assistant-1', 'user-2'])">
    Delete two messages
  </button>
  <button @click="reset">Reset</button>
  <WalliChat ref="chat" :messages="messages" style="height: 560px" />
</template>`;

const editMessageCode = `<script setup lang="ts">
import { ref } from "vue";
import {
  WalliChat,
  WalliChatComposer,
  type WalliChatAction,
  type WalliChatEditActionData,
  type WalliChatExpose,
} from "@wallilabs/chat/vue";

type EditAction = WalliChatAction<{}, { "edit-block": WalliChatEditActionData }>;
const chat = ref<WalliChatExpose>();

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

async function submit(markdown: string) {
  chat.value?.insertMessagesAtBottom([
    { id: crypto.randomUUID(), role: "user", markdown },
  ]);
  // Start the new assistant response here.
}
</script>

<template>
  <WalliChat
    ref="chat"
    :action-config="{ user: { edit: { visible: true, sort: 2 } } }"
    :messages="messages"
    :on-action="handleAction"
    style="height: 640px"
  >
    <WalliChatComposer slot="composer" value="" :on-submit="submit" />
  </WalliChat>
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
export const Actions: Story = {
  render: () => ({
    components: { WalliChat },
    setup: () => ({
      actionMessages,
      actionConfig: {
        assistant: {
          copy: { visible: true, sort: 1 },
          feedback: { visible: true, sort: 2 },
          share: { visible: true, sort: 3 },
          enhance: {
            component: ({ blockStates, setIcon }) => html`
              <details style="position:relative;width:32px;height:32px">
                <summary
                  style="box-sizing:border-box;display:flex;width:32px;height:32px;cursor:pointer;list-style:none;align-items:center;justify-content:center;border-radius:8px"
                  title="Enhance"
                >
                  ✨
                </summary>
                <div
                  style="position:absolute;z-index:10;bottom:calc(100% + 8px);left:50%;width:180px;transform:translateX(-50%);border:1px solid #e5e7eb;border-radius:12px;background:white;color:#111827;padding:12px;box-shadow:0 12px 32px rgb(0 0 0 / 18%);"
                >
                  <strong>Enhance response</strong>
                  <p style="margin:6px 0 10px;font-size:12px;color:#6b7280">
                    State entries: ${blockStates?.size ?? 0}
                  </p>
                  <button type="button" @click=${() => setIcon(fillIcon(Sparkles))}>Apply</button>
                </div>
              </details>
            `,
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
      },
      handleAction: (action: Parameters<NonNullable<Args["onAction"]>>[0]) => {
        if (action.type === "feedback" && "feedback" in action) {
          action.setIcon(fillIcon(action.feedback === "like" ? ThumbsUp : ThumbsDown));
          action.setIcon(undefined, action.feedback === "like" ? "dislike" : "like");
        }
        console.info("Action", action);
      },
    }),
    template: `<WalliChat
      :action-config="actionConfig"
      :messages="actionMessages"
      :on-action="handleAction"
      style="height: 320px"
    />`,
  }),
  parameters: source(`<script setup lang="ts">
import { Sparkles, ThumbsDown, ThumbsUp, type IconNode } from "lucide";
import { html } from "lit";
function fillIcon(icon: IconNode): IconNode {
  return icon.map(([tag, attributes]) => [tag, { ...attributes, fill: "currentColor" }]);
}

import { WalliChat, type WalliChatAction, type WalliChatMessage } from "@wallilabs/chat/vue";
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
const actionConfig = {
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
};
function handleAction(action: WalliChatAction) {
  if (action.type === "feedback" && "feedback" in action) {
    action.setIcon(fillIcon(action.feedback === "like" ? ThumbsUp : ThumbsDown));
    const other = action.feedback === "like" ? "dislike" : "like";
    action.setIcon(undefined, other);
  }
}
</script>

<template>
  <WalliChat
    :action-config="actionConfig"
    :messages="messages"
    :on-action="handleAction"
    style="height: 320px"
  />
</template>`),
};

export const Conversation: Story = { parameters: source(chatSource(conversation)) };

export const ReasoningStream: Story = {
  render: render(ReasoningStreamDemo),
  parameters: source(reasoningStreamCode),
};

function fillIcon(icon: IconNode): IconNode {
  return icon.map(([tag, attributes]) => [tag, { ...attributes, fill: "currentColor" }]);
}

export const TimeMessages: Story = {
  args: {
    intervalSeconds: 10 * 60,
    messages: createTimeMessages(),
    timeFormatter,
  },
  parameters: source(timeMessagesCode),
};
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
    template: `<ChatSurface v-bind="args" />`,
  }),
  parameters: source(chatSource(assistantMessage, 640)),
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
export const InitialIndex: Story = {
  render: render(InitialIndexDemo),
  parameters: source(initialIndexCode),
};
export const Responsive: Story = {
  args: { responsive: "xl" },
  render: (args) => ({
    components: { ResponsiveDemo },
    setup: () => ({ args }),
    template: '<ResponsiveDemo :responsive="args.responsive" />',
  }),
  parameters: source(responsiveCode),
};

export const InsertMessages: Story = {
  render: render(InsertMessagesDemo),
  parameters: source(insertMessagesCode),
};
export const ReplaceMessage: Story = {
  render: render(ReplaceMessageDemo),
  parameters: source(replaceMessageCode),
};
export const DeleteMessages: Story = {
  render: render(DeleteMessagesDemo),
  parameters: source(deleteMessagesCode),
};
export const EditMessage: Story = {
  render: render(EditMessageDemo),
  parameters: source(editMessageCode),
};
export const LoadOlderAtTop: Story = {
  render: () => ({ components: { PaginationDemo }, template: `<PaginationDemo load-at-top />` }),
  parameters: source(paginationCode(true)),
};
export const LoadNewerAtBottom: Story = {
  render: render(PaginationDemo),
  parameters: source(paginationCode(false)),
};
