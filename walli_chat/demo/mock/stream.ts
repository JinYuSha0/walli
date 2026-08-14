export type DemoSseRecord = {
  data: unknown;
  delayAfter?: number;
  event: "start" | "delta" | "tool-call" | "tool-result";
};

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

export function createDemoSseRecords(): DemoSseRecord[] {
  const stepsBoundary = STREAMING_MARKDOWN_DEMO.indexOf("\n\n## 执行步骤");
  const comparisonBoundary = STREAMING_MARKDOWN_DEMO.indexOf("\n\n## 数据对比");
  if (stepsBoundary < 0 || comparisonBoundary < 0) {
    throw new Error("Streaming demo tool boundaries are missing");
  }

  const records: DemoSseRecord[] = [
    {
      data: {
        model: "openai/gpt-5.4-mini",
        sessionId: "3b586ffb-1f4b-4c51-a08d-cfe0963f6a1b",
      },
      delayAfter: 700,
      event: "start",
    },
  ];

  appendMarkdownRecords(records, STREAMING_MARKDOWN_DEMO.slice(0, stepsBoundary));
  records.push(
    {
      data: {
        toolCallId: "call_N3vGSq4X9BrLWt72fqWPwMle",
        toolName: "memory_search",
        input: {
          query: "summarize previous conversation topics and any user preferences or ongoing tasks",
          userId: "x1JL36bVBGB7NyhCQMHik0JvJAUA4LUd",
          clientPlatform: "web",
          limit: 5,
        },
      },
      delayAfter: 4000,
      event: "tool-call",
    },
    {
      data: {
        toolCallId: "call_N3vGSq4X9BrLWt72fqWPwMle",
        toolName: "memory_search",
        output: { memories: [] },
      },
      event: "tool-result",
    },
  );

  appendMarkdownRecords(records, STREAMING_MARKDOWN_DEMO.slice(stepsBoundary, comparisonBoundary));
  records.push(
    {
      data: {
        toolCallId: "call_k7DP3mQw92VxA1tR8yZcH5Ln",
        toolName: "web_search",
        input: { query: "Walli streaming Markdown documentation" },
      },
      delayAfter: 4000,
      event: "tool-call",
    },
    {
      data: {
        toolCallId: "call_k7DP3mQw92VxA1tR8yZcH5Ln",
        toolName: "web_search",
        output: { results: [] },
      },
      event: "tool-result",
    },
  );
  appendMarkdownRecords(records, STREAMING_MARKDOWN_DEMO.slice(comparisonBoundary));

  return records;
}

function appendMarkdownRecords(records: DemoSseRecord[], markdown: string): void {
  records.push(
    ...chunkMarkdown(markdown).map((text): DemoSseRecord => ({
      data: { text },
      delayAfter: 35,
      event: "delta",
    })),
  );
}

function chunkMarkdown(markdown: string): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < markdown.length;) {
    const chunkLength = 16 + Math.floor(Math.random() * 17);
    chunks.push(markdown.slice(offset, offset + chunkLength));
    offset += chunkLength;
  }
  return chunks;
}
