import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { readPendingQuestion, savePendingQuestion, clearPendingQuestion } from "./pending-question";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("retains the complete question and target conversation across OAuth redirects", () => {
  const pending = { markdown: "帮我解释这段代码\n```js\nconst a = 1;\n```", sessionId: "session-a", autoSend: true };
  savePendingQuestion("support", pending);
  expect(readPendingQuestion("support")).toEqual(pending);
  expect(readPendingQuestion("another-chat")).toBeUndefined();
  savePendingQuestion("support", { ...pending, autoSend: false });
  expect(readPendingQuestion("support")).toEqual({ ...pending, autoSend: false });
  clearPendingQuestion("support");
  expect(readPendingQuestion("support")).toBeUndefined();
});
it("ignores invalid saved data", () => {
  sessionStorage.setItem("walli-chat-question:support", '{"markdown":5,"autoSend":true}');
  expect(readPendingQuestion("support")).toBeUndefined();
});
