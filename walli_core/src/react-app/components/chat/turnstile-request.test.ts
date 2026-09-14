import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webChatRequest } from "./web-chat-api";
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
it("obtains a fresh token for each mutation, with matching action and cancellation", async () => {
  const verifyBot = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
  const credentials = { userId: "visitor", token: "", verifyBot };
  const controller = new AbortController();
  await webChatRequest("support", "/sessions", credentials, { method: "POST", signal: controller.signal });
  await webChatRequest("support", "/sessions/session-a/messages", credentials, { method: "POST" });
  expect(verifyBot.mock.calls).toEqual([["chat_session", controller.signal], ["chat_message", undefined]]);
  expect(fetchMock.mock.calls[0][1].headers.get("X-Turnstile-Token")).toBe("first");
  expect(fetchMock.mock.calls[1][1].headers.get("X-Turnstile-Token")).toBe("second");
});
it("does not submit when verification is canceled or fails", async () => {
  const credentials = { userId: "visitor", token: "", verifyBot: vi.fn().mockRejectedValue(new Error("Canceled")) };
  await expect(webChatRequest("support", "/image", credentials, { method: "POST" })).rejects.toThrow("Canceled");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("skips challenges for history reads and already prepared single-use tokens", async () => {
  const verifyBot = vi.fn();
  const credentials = { userId: "visitor", token: "", verifyBot };
  await webChatRequest("support", "/sessions", credentials);
  await webChatRequest("support", "/sessions/session-a/messages", credentials, { method: "POST", headers: { "X-Turnstile-Token": "prepared" } });
  expect(verifyBot).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls[1][1].headers.get("X-Turnstile-Token")).toBe("prepared");
});
