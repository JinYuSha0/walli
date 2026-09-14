import { afterEach, beforeEach, expect, it, vi } from "vitest";
const env = vi.hoisted(() => ({ TURNSTILE_SECRET: "test-secret", TURNSTILE_HOSTNAMES: "chat.example.com" }));
vi.mock("@worker/lib/async-context", () => ({ getAsyncContext: () => ({ env }) }));
import { verifyTurnstile } from "./turnstile";
const fetchMock = vi.fn();
const valid = { success: true, action: "chat_message", hostname: "chat.example.com", cdata: "client-a" };
const verify = (token = "fresh-token", hostname = "chat.example.com") => verifyTurnstile(token, "chat_message", "client-a", hostname, "192.0.2.1");
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  env.TURNSTILE_SECRET = "test-secret";
  env.TURNSTILE_HOSTNAMES = "chat.example.com";
});
afterEach(() => vi.unstubAllGlobals());
it("checks the token server-side and sends its action, host, and client through validation", async () => {
  fetchMock.mockResolvedValue(Response.json(valid));
  expect(await verify()).toBe(true);
  expect(fetchMock.mock.calls[0][0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
  expect(body.get("secret")).toBe("test-secret");
  expect(body.get("response")).toBe("fresh-token");
  expect(body.get("remoteip")).toBe("192.0.2.1");
});
it.each([
  { success: false, "error-codes": ["timeout-or-duplicate"] },
  { ...valid, success: "true" },
  { ...valid, action: "chat_image" },
  { ...valid, hostname: "localhost" },
  { ...valid, hostname: "other.example.com" },
  { ...valid, cdata: "client-b" },
  null,
])("rejects invalid or reused tokens and mismatched metadata: %j", async (response) => {
  fetchMock.mockResolvedValue(Response.json(response));
  expect(await verify()).toBe(false);
});
it("rejects missing configuration, invalid tokens and unapproved hosts without contacting Cloudflare", async () => {
  expect(await verify("")).toBe(false);
  expect(await verify("x".repeat(2049))).toBe(false);
  expect(await verify("token", "localhost")).toBe(false);
  env.TURNSTILE_SECRET = "";
  expect(await verify()).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("fails closed on network, HTTP and JSON failures", async () => {
  fetchMock.mockRejectedValueOnce(new Error("Network failure"));
  expect(await verify()).toBe(false);
  fetchMock.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  expect(await verify()).toBe(false);
  fetchMock.mockResolvedValueOnce(new Response("not json"));
  expect(await verify()).toBe(false);
});
