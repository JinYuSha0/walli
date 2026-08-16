import "walli_chat/theme.css";
import { registerCustomBlock } from "walli_chat";
import type { WalliChatElement, WalliChatMessage, WalliChatStreamingHandle } from "walli_chat";
import { noticeBlockDefinition } from "./blocks/notice-block";
import { getDemoMessages } from "./store";
import { createDemoSseRecords } from "./mock/stream";

registerCustomBlock(noticeBlockDefinition);

const chat = document.querySelector<WalliChatElement>("walli-chat");

if (chat) {
  chat.messages = getDemoMessages();
  chat.onFeedback = (id, markdown, feedback) => {
    console.log("feedback", { id, markdown, feedback });
  };
  chat.onShare = (id, markdown) => {
    console.log("share", { id, markdown });
  };
}

const controls = document.createElement("div");
controls.style.display = "flex";
controls.style.flexDirection = "column";
controls.style.gap = "10px";
controls.style.alignItems = "stretch";
controls.style.boxSizing = "border-box";
controls.style.position = "fixed";
controls.style.top = "16px";
controls.style.right = "16px";
controls.style.zIndex = "10";
controls.style.width = "240px";
controls.style.maxWidth = "240px";
controls.style.padding = "12px";
controls.style.border = "1px solid #e5e7eb";
controls.style.borderRadius = "8px";
controls.style.background = "#ffffff";
controls.style.boxShadow = "0 1px 3px rgba(15, 23, 42, 0.08)";

const prependButton = document.createElement("button");
prependButton.textContent = "顶部插入 3 条";
applyButtonStyle(prependButton);
prependButton.addEventListener("click", () => {
  const nextMessages = createTopInsertionBatch();
  chat?.insertMessagesAtTop(nextMessages);
});

const appendButton = document.createElement("button");
appendButton.textContent = "尾部插入 3 条";
applyButtonStyle(appendButton);
appendButton.addEventListener("click", () => {
  const nextMessages = createBottomInsertionBatch();
  chat?.insertMessagesAtBottom(nextMessages);
});

const themeButton = document.createElement("button");
applyButtonStyle(themeButton);
updateThemeButtonLabel();
themeButton.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  document.body.style.background = document.documentElement.classList.contains("dark")
    ? "#171717"
    : "#f8fafc";
  controls.style.background = document.documentElement.classList.contains("dark")
    ? "#262626"
    : "#ffffff";
  controls.style.borderColor = document.documentElement.classList.contains("dark")
    ? "#404040"
    : "#e5e7eb";
  updateThemeButtonLabel();
});

const streamButton = document.createElement("button");
streamButton.textContent = "流式输出长 Markdown";
applyButtonStyle(streamButton);
let activeStreamingHandle: WalliChatStreamingHandle | null = null;
streamButton.addEventListener("click", async () => {
  if (!chat) return;

  if (activeStreamingHandle !== null) {
    activeStreamingHandle.abort("Demo streaming stopped by user");
    streamButton.textContent = "正在停止…";
    return;
  }

  streamButton.textContent = "再次点击停止";

  try {
    const handle = chat.insertStreamingMessageAtBottom(createMarkdownDemoStream(), {
      getToolLabel: (toolName) => `调用 ${toolName} 工具中`,
      messageId: `demo-stream-${Date.now()}`,
      // stickToBottom: true,
    });
    activeStreamingHandle = handle;
    await handle.finished;
  } finally {
    activeStreamingHandle = null;
    streamButton.textContent = "流式输出长 Markdown";
  }
});

const indexInput = document.createElement("input");
indexInput.type = "number";
indexInput.min = "0";
indexInput.value = "4520";
indexInput.style.width = "100%";
indexInput.style.boxSizing = "border-box";
indexInput.style.border = "1px solid #d1d5db";
indexInput.style.borderRadius = "8px";
indexInput.style.background = "#ffffff";
indexInput.style.color = "#111827";
indexInput.style.padding = "9px 10px";
indexInput.style.font =
  '600 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

const scrollButton = document.createElement("button");
scrollButton.textContent = "跳到 index";
applyButtonStyle(scrollButton);
scrollButton.addEventListener("click", () => {
  chat?.scrollToIndex({
    animated: false,
    index: getScrollTargetIndex(),
  });
});

const animatedScrollButton = document.createElement("button");
animatedScrollButton.textContent = "动画滚到 index";
applyButtonStyle(animatedScrollButton);
animatedScrollButton.addEventListener("click", () => {
  chat?.scrollToIndex({
    animated: true,
    index: getScrollTargetIndex(),
  });
});

const topInput = document.createElement("input");
topInput.type = "number";
topInput.min = "0";
topInput.value = "1200000";
topInput.style.width = "100%";
topInput.style.boxSizing = "border-box";
topInput.style.border = "1px solid #d1d5db";
topInput.style.borderRadius = "8px";
topInput.style.background = "#ffffff";
topInput.style.color = "#111827";
topInput.style.padding = "9px 10px";
topInput.style.font =
  '600 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

const scrollToButton = document.createElement("button");
scrollToButton.textContent = "滚到高度";
applyButtonStyle(scrollToButton);
scrollToButton.addEventListener("click", () => {
  chat?.scrollTo({
    animated: false,
    top: getScrollTargetTop(),
  });
});

const scrollTopButton = document.createElement("button");
scrollTopButton.textContent = "滚到顶部";
applyButtonStyle(scrollTopButton);
scrollTopButton.addEventListener("click", () => {
  chat?.scrollTo({ target: "top" });
});

const scrollBottomButton = document.createElement("button");
scrollBottomButton.textContent = "滚到底部";
applyButtonStyle(scrollBottomButton);
scrollBottomButton.addEventListener("click", () => {
  chat?.scrollTo({ target: "bottom" });
});

const hint = document.createElement("span");
hint.textContent = "滚到中间后点插入按钮，或输入 index 测试定位";
hint.style.font =
  '500 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
hint.style.color = "#6b7280";
hint.style.lineHeight = "20px";

controls.append(
  prependButton,
  appendButton,
  themeButton,
  streamButton,
  indexInput,
  scrollButton,
  animatedScrollButton,
  topInput,
  scrollToButton,
  scrollTopButton,
  scrollBottomButton,
  hint,
);
document.body.append(controls);

function updateThemeButtonLabel(): void {
  themeButton.textContent = document.documentElement.classList.contains("dark")
    ? "切换浅色模式"
    : "切换深色模式";
}

function applyButtonStyle(button: HTMLButtonElement): void {
  button.style.border = "1px solid #d1d5db";
  button.style.borderRadius = "999px";
  button.style.background = "#ffffff";
  button.style.color = "#111827";
  button.style.padding = "10px 14px";
  button.style.cursor = "pointer";
  button.style.width = "100%";
  button.style.font =
    '600 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  button.style.boxShadow = "0 1px 2px rgba(15, 23, 42, 0.08)";
}

function getScrollTargetIndex(): number {
  const maxIndex = Math.max(0, (chat?.messages.length ?? 1) - 1);
  const index = Number(indexInput.value);
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(maxIndex, Math.floor(index)));
}

function getScrollTargetTop(): number {
  const top = Number(topInput.value);
  if (!Number.isFinite(top)) return 0;
  return Math.max(0, top);
}

let insertionSequence = 0;

function createTopInsertionBatch(): WalliChatMessage[] {
  const batch = ++insertionSequence;
  return [
    {
      id: `top-${batch}-assistant-1`,
      role: "assistant",
      markdown: [
        `### 历史消息批次 #${batch}`,
        "",
        "这是一次**顶部插入**，用于测试上拉加载旧消息后，当前视口是否还能停在原来的阅读位置。",
      ].join("\n"),
    },
    {
      id: `top-${batch}-user-1`,
      role: "user",
      markdown: `收到，继续回放更早的上下文（batch ${batch}）。`,
    },
    {
      id: `top-${batch}-assistant-2`,
      role: "assistant",
      markdown: [
        "- 目标：保持当前可见范围",
        `- 方向：top #${batch}`,
        "- 观察点：首个可见消息不要突然跳走",
      ].join("\n"),
    },
  ];
}

function createBottomInsertionBatch(): WalliChatMessage[] {
  const batch = ++insertionSequence;
  return [
    {
      id: `bottom-${batch}-assistant-1`,
      role: "assistant",
      markdown: [
        `### 新消息批次 #${batch}`,
        "",
        "这是一次**尾部插入**，用于测试新消息进入列表后，当前阅读位置是否仍然稳定。",
      ].join("\n"),
    },
    {
      id: `bottom-${batch}-user-1`,
      role: "user",
      markdown: `好的，我还在看前面的内容；这条是 batch ${batch} 的跟进。`,
    },
    {
      id: `bottom-${batch}-assistant-2`,
      role: "assistant",
      markdown: [
        "```json",
        "{",
        `  "batch": ${batch},`,
        '  "direction": "bottom",',
        '  "expectation": "keep-visible-range"',
        "}",
        "```",
      ].join("\n"),
    },
  ];
}

function createMarkdownDemoStream(): ReadableStream<string> {
  const records = createDemoSseRecords();
  let offset = 0;

  return new ReadableStream<string>({
    async pull(controller) {
      if (offset >= records.length) {
        controller.close();
        return;
      }

      const previousRecord = records[offset - 1];
      const delay = previousRecord?.delayAfter ?? 0;
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      const record = records[offset++]!;
      controller.enqueue(createSseRecord(record.event, record.data));
    },
  });
}

function createSseRecord(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
