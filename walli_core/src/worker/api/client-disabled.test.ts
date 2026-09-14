import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("./clients", () => ({
  getClientFromClientId: async () => ({ id: "client-id", platform: "web" }),
  getClientBasicSettings: async () => ({ enabled: false }),
  getClientAuthSettings: mocks.auth,
}));
vi.mock("./helper/cors", () => ({ handleCors: () => async (_: unknown, next: () => Promise<void>) => next() }));
vi.mock("./helper/middleware", () => ({ requireAdmin: vi.fn() }));
vi.mock("./settings", () => ({ getSettings: vi.fn() }));
vi.mock("@worker/lib/chat-runner", () => ({
  ChatCompletionLimitError: class extends Error {},
  createOutputTokenLimitOptions: vi.fn(), createChatUserInfo: vi.fn(), prepareChatCompletion: vi.fn(),
}));
vi.mock("../tools/tool-media", () => ({ transcribeVoice: vi.fn() }));
import { chatRoute } from "./chat";
import { transcribeRoute } from "./transcribe";

it.each([
  ["POST", "/api/chat/session", { userId: "user" }],
  ["DELETE", "/api/chat/session", { userId: "user", sessionId: "session" }],
  ["POST", "/api/chat/history", { userId: "user", sessionId: "session" }],
  ["POST", "/api/chat", { userId: "user", sessionId: "session", messages: [{ role: "user", content: "Hello" }] }],
])("returns 401 for disabled clients: %s %s", async (method, path, body) => {
  const response = await chatRoute.request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Client disabled" });
  expect(mocks.auth).not.toHaveBeenCalled();
});
it("rejects transcription before processing audio for disabled clients", async () => {
  const form = new FormData();
  form.set("appId", "client-id");
  form.set("userId", "user");
  expect((await transcribeRoute.request("/api/transcribe", { method: "POST", body: form })).status).toBe(401);
  expect(mocks.auth).not.toHaveBeenCalled();
});
