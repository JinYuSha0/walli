import "../theme.css";
import "../web-components";
import { getDemoMessages } from "./store";
import type { WalliChatElement } from "../web-components";
import type { WalliChatMessage, WalliChatStreamingHandle } from "../types";

const chat = document.querySelector<WalliChatElement>("walli-chat");
const app = document.querySelector<HTMLElement>("#app");

if (chat) {
  chat.messages = getDemoMessages();
}

if (app) {
  app.style.padding = "16px";
  app.style.boxSizing = "border-box";
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
  chat.scrollTo({ target: "bottom" });

  try {
    const handle = chat.insertStreamingMessageAtBottom(createMarkdownDemoStream(), {
      stickToBottom: true,
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
indexInput.value = "20";
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
topInput.value = "600";
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
      role: "assistant",
      markdown: [
        `### 历史消息批次 #${batch}`,
        "",
        "这是一次**顶部插入**，用于测试上拉加载旧消息后，当前视口是否还能停在原来的阅读位置。",
      ].join("\n"),
    },
    {
      role: "user",
      markdown: `收到，继续回放更早的上下文（batch ${batch}）。`,
    },
    {
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
      role: "assistant",
      markdown: [
        `### 新消息批次 #${batch}`,
        "",
        "这是一次**尾部插入**，用于测试新消息进入列表后，当前阅读位置是否仍然稳定。",
      ].join("\n"),
    },
    {
      role: "user",
      markdown: `好的，我还在看前面的内容；这条是 batch ${batch} 的跟进。`,
    },
    {
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

const STREAMING_MARKDOWN_DEMO = `# Walli 流式 Markdown 演示

这是一段逐块写入的长 Markdown，用来观察尚未闭合的 **粗体文本**、*斜体文本*、~~删除线~~ 和 \`行内代码\` 是否能在生成过程中稳定渲染。

## 功能概览

- 消息会立即插入到聊天列表底部
- 每收到一个 chunk 都会重新排版
- 流式阶段由 **remend** 修复暂时未闭合的 Markdown
- ReadableStream 结束后进行最终解析

> 流式输出的关键不是等全文生成完毕，而是让读者能尽早看到结构清晰、持续增长的内容。
>
> 即使标记暂时只生成了一半，界面也不应该闪烁成错误的结构。

## 执行步骤

1. 创建一条空的 assistant 消息。
2. 从 stream 中读取字符串或 UTF-8 字节。
3. 把新内容追加到最后一条消息。
4. 使用 remend 补全当前片段，再交给 Markdown parser。
5. stream 关闭后，使用原始完整内容做最后一次渲染。

## API 示例

\`\`\`ts
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ prompt: "介绍 Walli" }),
});

if (!response.body) {
  throw new Error("Response body is empty");
}

await chat.insertStreamingMessageAtBottom(response.body);
\`\`\`

## 数据对比

| 阶段 | Markdown 状态 | 渲染策略 |
| --- | --- | --- |
| 开始 | 内容为空 | 创建 assistant 对话框 |
| 生成中 | 语法可能未闭合 | remend 临时补全 |
| 已完成 | Markdown 完整 | 使用原文最终解析 |

你也可以访问 [Walli 项目主页](https://github.com/) 查看相关说明。图片、列表、代码块和表格都会随着内容到达逐步出现。

---

### 最终结果

当这段文字完整显示时，代表 ReadableStream 已经关闭，返回的 Promise 也已经在最终渲染完成后 resolved。
`;

function createMarkdownDemoStream(): ReadableStream<string> {
  let offset = 0;

  return new ReadableStream<string>({
    async pull(controller) {
      if (offset >= STREAMING_MARKDOWN_DEMO.length) {
        controller.close();
        return;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      const chunkLength = 16 + Math.floor(Math.random() * 17);
      controller.enqueue(STREAMING_MARKDOWN_DEMO.slice(offset, offset + chunkLength));
      offset += chunkLength;
    },
  });
}
