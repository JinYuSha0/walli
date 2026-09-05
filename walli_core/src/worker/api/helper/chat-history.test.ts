import { describe, expect, it } from "vitest";
import { toWebHistoryMessage } from "./chat-history";

const stored = (role: string, content: unknown) => ({
  id: "message-1",
  content: JSON.stringify({ role, content }),
  createdAt: 1_725_638_400_000,
});

describe("chat history", () => {
  it("shows scheduled assistant text stored as model content parts", () => {
    expect(toWebHistoryMessage(stored("assistant", [
      { type: "text", text: "时间到了" },
    ]))).toEqual({
      id: "message-1",
      role: "assistant",
      markdown: "时间到了",
      createdAt: 1_725_638_400_000,
    });
  });

  it("preserves ordinary string messages", () => {
    expect(toWebHistoryMessage(stored("user", "你好"))?.markdown).toBe("你好");
    expect(toWebHistoryMessage(stored("assistant", "你好"))?.markdown).toBe("你好");
  });

  it("extracts text without exposing reasoning or tool calls", () => {
    expect(toWebHistoryMessage(stored("assistant", [
      { type: "reasoning", text: "internal" },
      { type: "tool-call", toolName: "search", input: {} },
      { type: "text", text: "第一段" },
      null,
      { type: "text", text: "第二段" },
    ]))?.markdown).toBe("第一段\n\n第二段");
  });

  it("omits internal, empty and malformed messages", () => {
    for (const message of [
      stored("system", "internal"),
      stored("tool", [{ type: "tool-result", output: "internal" }]),
      stored("assistant", [{ type: "tool-call" }]),
      stored("assistant", " "),
      { id: "bad", content: "invalid JSON", createdAt: 1_725_638_400_000 },
    ]) expect(toWebHistoryMessage(message)).toBeUndefined();
  });
});
