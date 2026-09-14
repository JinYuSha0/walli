import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), run: vi.fn(), set: vi.fn(), kvGet: vi.fn(), kvPut: vi.fn(), turnstileReady: vi.fn() }));
vi.mock("@worker/db/client", () => ({
  createDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ get: mocks.get }) }) }),
    update: () => ({
      set: (value: unknown) => {
        mocks.set(value);
        return { where: () => ({ run: mocks.run }) };
      },
    }),
  }),
}));
vi.mock("./helper/middleware", () => ({
  requireAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock("./settings", () => ({
  getSettings: async () => ({
    dialogSystemPrompt: "",
    authEnabled: false,
    authEndpointUrl: "",
    corsAllowedOrigins: [],
  }),
}));
vi.mock("@worker/lib/async-context", () => ({
  getAsyncContext: () => ({ env: { APP_KV: { get: mocks.kvGet, put: mocks.kvPut } } }),
}));
vi.mock("./helper/turnstile", () => ({ isTurnstileConfigured: mocks.turnstileReady }));
import { clientsRoute, getClientWebSettings, getClientBasicSettings, getClientUsageLimit } from "./clients";

const client = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Original",
  slug: "original",
  platform: "web",
};
const patch = (body: unknown) =>
  clientsRoute.request(`/api/admin/clients/${client.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.turnstileReady.mockReturnValue(true);
  mocks.kvGet.mockResolvedValue(null);
  mocks.run.mockResolvedValue(undefined);
});

it("saves name and basic settings together without changing slug", async () => {
  mocks.get.mockResolvedValue({ ...client });
  const response = await patch({ name: " Renamed ", enabled: true, additionalSystemPrompt: " Prompt " });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    name: "Renamed", slug: client.slug,
    basicSettings: { enabled: true, additionalSystemPrompt: "Prompt" },
  });
  expect(mocks.set).toHaveBeenCalledWith({ name: "Renamed", updatedAt: expect.any(Number) });
  expect(mocks.kvPut).toHaveBeenCalledWith(expect.any(String), JSON.stringify({ enabled: true, autoDeletePeriod: "never", additionalSystemPrompt: "Prompt" }));
});
it("rejects any slug update without writing settings", async () => {
  mocks.get.mockResolvedValue({ ...client });
  for (const body of [{ slug: "new-slug" }, { name: "Renamed", slug: client.slug }, { enabled: true, slug: "new-slug" }]) {
    expect((await patch(body)).status).toBe(400);
  }
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.kvPut).not.toHaveBeenCalled();
});
it("rejects blank names and platform changes", async () => {
  mocks.get.mockResolvedValue({ ...client });
  for (const body of [{ name: " " }, { name: "Renamed", platform: "telegram" }]) {
    expect((await patch(body)).status).toBe(400);
  }
  expect(mocks.set).not.toHaveBeenCalled();
});

it("skips the name write when omitted or unchanged after trimming", async () => {
  mocks.get.mockResolvedValue({ ...client });
  for (const body of [{ enabled: true }, { name: " Original ", enabled: true }]) {
    const response = await patch(body);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: client.name, basicSettings: { enabled: true } });
  }
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.kvPut).toHaveBeenCalledTimes(2);
});

it("ignores the removed dialog prompt without losing saved dialog settings", async () => {
  mocks.get.mockResolvedValue({ ...client });
  mocks.kvGet.mockImplementation(async (key: string) => key.endsWith(":dialog-settings")
    ? { dialogSystemPrompt: "Legacy prompt", assistantNickname: "Helper", dialogOpeningMessage: "Welcome" }
    : null);
  const response = await clientsRoute.request(`/api/admin/clients/${client.id}`);
  expect(response.status).toBe(200);
  const config = await response.json();
  expect(config.dialogSettings).toMatchObject({ assistantNickname: "Helper", dialogOpeningMessage: "Welcome" });
  expect(config.dialogSettings).not.toHaveProperty("dialogSystemPrompt");
});

it("requires a nickname when identity is enabled, including partial updates", async () => {
  mocks.get.mockResolvedValue({ ...client });
  expect((await patch({ assistantIdentityEnabled: true })).status).toBe(400);
  expect((await patch({ assistantIdentityEnabled: true, assistantNickname: " " })).status).toBe(400);
  expect(mocks.kvPut).not.toHaveBeenCalled();
  expect((await patch({ assistantIdentityEnabled: true, assistantNickname: " Helper " })).status).toBe(200);
  mocks.kvGet.mockImplementation(async (key: string) => key.endsWith(":dialog-settings")
    ? { assistantIdentityEnabled: true, assistantNickname: "Helper" } : null);
  expect((await patch({ assistantNickname: "" })).status).toBe(400);
  expect((await patch({ assistantIdentityEnabled: false, assistantNickname: "" })).status).toBe(200);
});

it("persists web access independently from client enablement", async () => {
  mocks.get.mockResolvedValue(client);
  mocks.kvGet.mockImplementation(async (key: string) => key.endsWith(":basic-settings") ? { enabled: true, additionalSystemPrompt: "" } : null);
  const response = await patch({ webAccessEnabled: false });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ basicSettings: { enabled: true }, webSettings: { webAccessEnabled: false } });
  expect(mocks.kvPut).toHaveBeenCalledExactlyOnceWith(`client:${client.id}:web-settings`, JSON.stringify({ webAccessEnabled: false, loginMethod: "none", turnstileEnabled: false }));
});
it("rejects web settings on native clients", async () => {
  mocks.get.mockResolvedValue({ ...client, platform: "flutter" });
  expect((await patch({ webAccessEnabled: true })).status).toBe(400);
  expect(mocks.kvPut).not.toHaveBeenCalled();
});
it("preserves Google login when toggling web access and rejects unknown methods", async () => {
  mocks.get.mockResolvedValue(client);
  mocks.kvGet.mockImplementation(async (key: string) => key.endsWith(":web-settings") ? { webAccessEnabled: true, loginMethod: "google" } : null);
  const response = await patch({ webAccessEnabled: false });
  expect(await response.json()).toMatchObject({ webSettings: { webAccessEnabled: false, loginMethod: "google" } });
  expect((await patch({ loginMethod: "password" })).status).toBe(400);
});

it("saves bot verification independently from login and web access", async () => {
  mocks.get.mockResolvedValue(client);
  const response = await patch({ turnstileEnabled: true });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ webSettings: { webAccessEnabled: true, loginMethod: "none", turnstileEnabled: true } });
});

it("rejects enabling Turnstile without configuration while allowing it to be disabled", async () => {
  mocks.get.mockResolvedValue(client);
  mocks.turnstileReady.mockReturnValue(false);
  expect((await patch({ turnstileEnabled: true })).status).toBe(400);
  expect(mocks.kvPut).not.toHaveBeenCalled();
  const response = await patch({ turnstileEnabled: false });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ turnstileConfigured: false, webSettings: { turnstileEnabled: false } });
});

it("keeps Turnstile enablement isolated by client ID", async () => {
  mocks.kvGet.mockImplementation(async (key: string) => key === "client:protected:web-settings"
    ? { webAccessEnabled: true, turnstileEnabled: true }
    : { webAccessEnabled: true, turnstileEnabled: false });
  expect((await getClientWebSettings("protected")).turnstileEnabled).toBe(true);
  expect((await getClientWebSettings("unprotected")).turnstileEnabled).toBe(false);
});

it("saves the client switch and retention period in one basic settings write", async () => {
  mocks.get.mockResolvedValue({ ...client });
  const response = await patch({ name: "Original", enabled: true, additionalSystemPrompt: "", autoDeletePeriod: "day" });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ basicSettings: { enabled: true, autoDeletePeriod: "day" } });
  expect(mocks.kvPut).toHaveBeenCalledTimes(1);
  expect(mocks.kvPut).toHaveBeenCalledWith(`client:${client.id}:basic-settings`, JSON.stringify({ enabled: true, autoDeletePeriod: "day", additionalSystemPrompt: "" }));
});

it("preserves legacy retention and usage limits while preferring the new basic setting", async () => {
  mocks.kvGet.mockImplementation(async (key: string) => key.endsWith(":usage-limit")
    ? { autoDeletePeriod: "never", historyMessageLimit: 42 }
    : { enabled: true });
  expect(await getClientBasicSettings(client.id)).toMatchObject({ enabled: true, autoDeletePeriod: "never" });
  const usage = await getClientUsageLimit(client.id);
  expect(usage.historyMessageLimit).toBe(42);
  expect(usage).not.toHaveProperty("autoDeletePeriod");
  mocks.kvGet.mockImplementation(async (key: string) => key.endsWith(":basic-settings")
    ? { enabled: true, autoDeletePeriod: "day" }
    : { autoDeletePeriod: "never" });
  expect((await getClientBasicSettings(client.id)).autoDeletePeriod).toBe("day");
});
