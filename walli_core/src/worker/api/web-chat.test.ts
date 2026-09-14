import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  google: vi.fn(),
  turnstile: vi.fn(),
  user: vi.fn(),
  basic: vi.fn(),
  web: vi.fn(),
  dialog: vi.fn(),
  auth: vi.fn(),
  verify: vi.fn(),
  stream: vi.fn(),
  store: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  history: vi.fn(),
  softDelete: vi.fn(),
  hardDelete: vi.fn(),
}));
vi.mock("./clients", () => ({
  getClientBySlug: mocks.client,
  getClientBasicSettings: mocks.basic,
  getClientWebSettings: mocks.web,
  getClientDialogSettings: mocks.dialog,
  getClientAuthSettings: mocks.auth,
}));
vi.mock("./chat", () => ({
  getChatHistoryPage: mocks.history,
  streamChat: mocks.stream,
  verifyChatAuth: mocks.verify,
}));
vi.mock("./settings", () => ({ isMultiSessionClient: async () => true }));
vi.mock("./upload", () => ({ upload: vi.fn() }));
vi.mock("./transcribe", () => ({ transcribe: vi.fn() }));
vi.mock("@worker/utils/llm", () => ({ createTemporaryAssetUrl: async (url: string) => url }));
vi.mock("@worker/lib/chat-runner", () => ({ createChatUserInfo: (value: unknown) => value }));
vi.mock("@worker/lib/async-context", () => ({
  getAsyncContext: () => ({
    env: {
      API_TOKEN: "test-signing-secret-which-is-long-enough",
      USER_DO: { getByName: mocks.store },
    },
  }),
}));
vi.mock("./helper/turnstile", () => ({ verifyTurnstile: mocks.turnstile }));
vi.mock("./helper/auth", () => ({ hasGoogleAccount: mocks.google }));
import { Hono } from "hono";
import type { AppBindings } from "./types";
import { webChatRoute } from "./web-chat";
const app = new Hono<AppBindings>().use("*", async (c, next) => {
  c.set("user", mocks.user());
  await next();
}).route("/", webChatRoute);
const client = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Support",
  slug: "support",
  platform: "web",
};
const request = (path: string, init?: RequestInit) =>
  app.request(`https://example.com/api/web-chat/support${path}`, init);
const cookie = async () => (await request("/config", { headers: { "X-Chat-Device": crypto.randomUUID().replaceAll("-", "").repeat(2) } })).headers.get("Set-Cookie")!.split(";")[0];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue(client);
  mocks.web.mockResolvedValue({ webAccessEnabled: true, loginMethod: "none" });
  mocks.basic.mockResolvedValue({ enabled: true, additionalSystemPrompt: "Client instructions" });
  mocks.dialog.mockResolvedValue({
    assistantIdentityEnabled: true,
    assistantNickname: "Helper",
    assistantAvatar: "",
    dialogSystemPrompt: "Private instructions",
    dialogOpeningMessage: "Hello",
    dialogPlaceholder: "Message",
    dialogInputMaxLength: 10,
    dialogImageEnabled: false,
    dialogSpeechEnabled: false,
  });
  mocks.auth.mockResolvedValue({ authEnabled: false });
  mocks.store.mockReturnValue({
    createSession: mocks.create,
    getSession: mocks.get,
    listSessionsPage: mocks.list,
    softDeleteSession: mocks.softDelete,
    deleteSession: mocks.hardDelete,
  });
  mocks.create.mockResolvedValue({ id: "session-a", title: "", createdAt: 1 });
  mocks.get.mockResolvedValue({ id: "session-a" });
  mocks.list.mockResolvedValue({ sessions: [], nextCursor: null });
  mocks.softDelete.mockResolvedValue({ deletedSessionCount: 1 });
});
it("publishes only enabled web clients and hides private prompts", async () => {
  const response = await request("/config", { headers: { "X-Chat-Device": "a".repeat(64) } });
  expect(response.status).toBe(200);
  const config = await response.json();
  expect(config.dialogSettings.assistantNickname).toBe("Helper");
  expect(JSON.stringify(config)).not.toContain("Private instructions");
  expect(JSON.stringify(config)).not.toContain("Client instructions");
  mocks.basic.mockResolvedValue({ enabled: false });
  expect((await request("/config")).status).toBe(401);
  mocks.client.mockResolvedValue({ ...client, platform: "telegram" });
  expect((await request("/config")).status).toBe(404);
});
it("requires a signed visitor cookie and isolates visitors", async () => {
  expect((await request("/sessions", { method: "POST" })).status).toBe(401);
  const first = await cookie();
  const second = await cookie();
  expect((await request("/sessions", { method: "POST", headers: { Cookie: first } })).status).toBe(
    201,
  );
  expect((await request("/sessions", { headers: { Cookie: second } })).status).toBe(200);
  const names = mocks.store.mock.calls.map(([name]) => name);
  expect(names[0]).not.toBe(names[1]);
  expect(names[0]).toContain(`${client.id}:web:web_${client.id}_`);
});
it("rejects cross-origin writes and sessions outside the visitor's store", async () => {
  const visitor = await cookie();
  expect(
    (
      await request("/sessions", {
        method: "POST",
        headers: { Cookie: visitor, Origin: "https://other.example" },
      })
    ).status,
  ).toBe(403);
  mocks.get.mockResolvedValue(undefined);
  expect(
    (await request("/sessions/someone-elses-session", { headers: { Cookie: visitor } })).status,
  ).toBe(404);
});
it("enforces auth even if a previously issued visitor cookie is present", async () => {
  const visitor = await cookie();
  mocks.web.mockResolvedValue({ webAccessEnabled: true, loginMethod: "google" });
  mocks.verify.mockResolvedValue({ authorized: false });
  expect((await request("/sessions", { headers: { Cookie: visitor } })).status).toBe(401);
  expect(mocks.store).not.toHaveBeenCalled();
});
it("applies message limits and image/speech settings on the server", async () => {
  const visitor = await cookie();
  const headers = { Cookie: visitor, "Content-Type": "application/json" };
  expect(
    (
      await request("/sessions/session-a/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "More than ten characters" }),
      })
    ).status,
  ).toBe(400);
  expect((await request("/image", { method: "POST", headers })).status).toBe(403);
  expect((await request("/transcribe", { method: "POST", headers })).status).toBe(403);
  mocks.stream.mockResolvedValue(new Response("stream"));
  expect(
    (
      await request("/sessions/session-a/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Hi" }),
      })
    ).status,
  ).toBe(200);
  expect(mocks.stream.mock.calls[0]?.slice(1)).toEqual([
    { sessionId: "session-a", messages: [{ role: "user", content: "Hi" }] },
    expect.objectContaining({ clientId: client.id }),
    "web",
    "Client instructions",
  ]);
});

it("validates and forwards the stable session pagination cursor", async () => {
  const visitor = await cookie();
  const cursor = { createdAt: 123, id: "session-a" };
  const page = {
    sessions: [{ id: "session-b", title: "Older", createdAt: 122 }],
    nextCursor: null,
  };
  mocks.list.mockResolvedValue(page);
  const response = await request(`/sessions?cursor=${encodeURIComponent(JSON.stringify(cursor))}`, {
    headers: { Cookie: visitor },
  });
  expect(await response.json()).toEqual(page);
  expect(mocks.list).toHaveBeenCalledWith({ cursor, limit: 10 });
  for (const invalid of [
    "garbage",
    "null",
    '{"createdAt":-1,"id":"x"}',
    '{"createdAt":123,"id":""}',
  ]) {
    expect(
      (
        await request(`/sessions?cursor=${encodeURIComponent(invalid)}`, {
          headers: { Cookie: visitor },
        })
      ).status,
    ).toBe(400);
  }
  expect(mocks.list).toHaveBeenCalledTimes(1);
});
it("returns session metadata for direct links and preserves message pagination", async () => {
  const visitor = await cookie();
  const session = { id: "session-a", title: "A previous conversation", createdAt: 1 };
  mocks.get.mockResolvedValue(session);
  mocks.history.mockResolvedValue({ messages: [], nextCursor: 12 });
  const response = await request("/sessions/session-a?cursor=30", { headers: { Cookie: visitor } });
  expect(await response.json()).toEqual({ session, messages: [], nextCursor: 12 });
  expect(mocks.history).toHaveBeenCalledWith(
    expect.objectContaining({ sessionId: "session-a", cursor: 30, limit: 30 }),
  );
});
it("only soft-deletes owned sessions and rejects deleted session reads and sends", async () => {
  const visitor = await cookie();
  const headers = { Cookie: visitor, "Content-Type": "application/json" };
  expect((await request("/sessions/session-a", { method: "DELETE", headers })).status).toBe(200);
  expect(mocks.softDelete).toHaveBeenCalledWith("session-a");
  expect(mocks.hardDelete).not.toHaveBeenCalled();
  mocks.get.mockResolvedValue(undefined);
  expect((await request("/sessions/session-a", { headers })).status).toBe(404);
  expect((await request("/sessions/session-a", { method: "DELETE", headers })).status).toBe(404);
  expect(
    (
      await request("/sessions/session-a/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Hi" }),
      })
    ).status,
  ).toBe(404);
  expect(mocks.softDelete).toHaveBeenCalledTimes(1);
  expect(mocks.history).not.toHaveBeenCalled();
  expect(mocks.stream).not.toHaveBeenCalled();
});

it("blocks all web routes independently when web access is disabled", async () => {
  mocks.web.mockResolvedValue({ webAccessEnabled: false });
  for (const path of ["/config", "/sessions", "/sessions/session-a/messages"]) {
    expect((await request(path)).status).toBe(404);
  }
  mocks.basic.mockResolvedValue({ enabled: false });
  expect((await request("/sessions", { method: "POST" })).status).toBe(401);
  expect(mocks.store).not.toHaveBeenCalled();
});

it("requires a verified Google account and ignores caller supplied identity", async () => {
  mocks.web.mockResolvedValue({ webAccessEnabled: true, loginMethod: "google" });
  expect(await (await request("/config")).json()).toMatchObject({ loginMethod: "google", authenticated: false });
  expect(await (await request("/config")).json()).not.toHaveProperty("userName");
  expect(await (await request("/config")).json()).not.toHaveProperty("userImage");
  for (const [path, method] of [["/sessions", "GET"], ["/sessions", "POST"], ["/sessions/session-a", "DELETE"], ["/sessions/session-a/messages", "POST"], ["/image", "POST"], ["/transcribe", "POST"]]) {
    expect((await request(path, { method, headers: { "X-Chat-User": "forged", Authorization: "Bearer forged" } })).status).toBe(401);
  }
  mocks.user.mockReturnValue({ id: "google-user", name: "User", email: "user@example.com", image: "https://lh3.googleusercontent.com/avatar" });
  mocks.google.mockResolvedValue(false);
  expect((await request("/sessions")).status).toBe(401);
  mocks.google.mockResolvedValue(true);
  expect(await (await request("/config")).json()).toMatchObject({ authenticated: true, userName: "User", userImage: "https://lh3.googleusercontent.com/avatar", userId: `web_${client.id}_google_google-user` });
  expect((await request("/sessions")).status).toBe(200);
  expect(mocks.store).toHaveBeenLastCalledWith(`${client.id}:web:web_${client.id}_google_google-user`);
});
it("restores the same anonymous device without sharing histories between devices", async () => {
  const device = "b".repeat(64);
  const first = (await request("/config", { headers: { "X-Chat-Device": device } })).headers.get("Set-Cookie")!.split(";")[0];
  const second = (await request("/config", { headers: { "X-Chat-Device": device } })).headers.get("Set-Cookie")!.split(";")[0];
  expect(first).toBe(second);
  expect((await request("/config", { headers: { "X-Chat-Device": "invalid" } })).status).toBe(400);
});

it("gates every web mutation with Turnstile before executing the handler", async () => {
  const visitor = await cookie();
  mocks.web.mockResolvedValue({ webAccessEnabled: true, loginMethod: "none", turnstileEnabled: true });
  mocks.turnstile.mockResolvedValue(false);
  for (const [path, method, action] of [
    ["/sessions", "POST", "chat_session"],
    ["/sessions/session-a/messages", "POST", "chat_message"],
    ["/sessions/session-a", "DELETE", "chat_delete"],
    ["/image", "POST", "chat_image"],
    ["/transcribe", "POST", "chat_transcribe"],
  ]) {
    expect((await request(path, { method, headers: { Cookie: visitor, "X-Turnstile-Token": "invalid" } })).status).toBe(403);
    expect(mocks.turnstile).toHaveBeenLastCalledWith("invalid", action, client.id, "example.com", undefined);
  }
  expect(mocks.store).not.toHaveBeenCalled();
  mocks.turnstile.mockResolvedValue(true);
  expect((await request("/sessions", { method: "POST", headers: { Cookie: visitor, "X-Turnstile-Token": "valid" } })).status).toBe(201);
});
it("does not require Turnstile when disabled", async () => {
  const visitor = await cookie();
  expect((await request("/sessions", { method: "POST", headers: { Cookie: visitor } })).status).toBe(201);
  expect(mocks.turnstile).not.toHaveBeenCalled();
});
