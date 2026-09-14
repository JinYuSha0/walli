import { beforeEach, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppBindings } from "./types";
const r2 = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn() }));
vi.mock("@worker/lib/async-context", () => ({ getAsyncContext: () => ({ env: { R2: r2 } }) }));
vi.mock("./helper/auth", () => ({ hasAdminRole: (user: { role: string }) => user.role === "admin" }));
vi.mock("../utils/llm", () => ({ hasValidTemporaryAssetUrl: vi.fn() }));
import { upload as uploadAsset, uploadRoute } from "./upload";
const app = new Hono<AppBindings>().use("*", async (c, next) => {
  if (c.req.header("x-test-admin")) c.set("user", { role: "admin" } as AppBindings["Variables"]["user"]);
  await next();
}).route("/", uploadRoute);
const upload = (file: File, admin = true) => {
  const body = new FormData(); body.set("file", file);
  return app.request("/api/admin/assistant-avatar", { method: "POST", body, headers: admin ? { "x-test-admin": "yes" } : {} });
};
beforeEach(() => vi.resetAllMocks());
it("requires admin authentication", async () => {
  expect((await upload(new File(["test"], "test.png", { type: "image/png" }), false)).status).toBe(401);
  expect(r2.put).not.toHaveBeenCalled();
});
it("rejects oversized images and spoofed or truncated signatures", async () => {
  for (const [bytes, status] of [[new Uint8Array(2 * 1024 * 1024 + 1), 413], [new Uint8Array([0x89]), 415]] as const) {
    expect((await upload(new File([bytes], "test.png", { type: "image/png" }))).status).toBe(status);
  }
  expect(r2.put).not.toHaveBeenCalled();
});
it("uploads a validated image and returns a permanent avatar path", async () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const response = await upload(new File([bytes], "avatar.png", { type: "image/png" }));
  expect(response.status).toBe(201);
  expect((await response.json()).url).toMatch(/^\/api\/assistant-avatars\/[0-9a-f-]+$/);
  expect(r2.put).toHaveBeenCalledOnce();
});

it("stores client uploads in separate folders and reads both new and legacy paths", async () => {
  const scoped = new Hono<AppBindings>().use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as AppBindings["Variables"]["user"]);
    await next();
  }).post("/image", (c) => uploadAsset(c, "image", "user-1", "client-a")).route("/", uploadRoute);
  const body = new FormData();
  body.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo.jpg", { type: "image/jpeg" }));
  const uploaded = await scoped.request("/image", { method: "POST", body });
  expect(uploaded.status).toBe(201);
  const asset = await uploaded.json() as { id: string; url: string };
  expect(new URL(asset.url).pathname).toBe(`/api/assets/client-a/user-1/image/${asset.id}`);
  expect(r2.put).toHaveBeenCalledWith(`uploads/client-a/user-1/images/${asset.id}`, expect.anything(),
    expect.objectContaining({ customMetadata: { kind: "image", name: "photo.jpg", userId: "user-1", clientId: "client-a" } }));
  for (const clientId of ["client-a", undefined]) {
    r2.get.mockResolvedValue({
      body: "image", size: 5, httpEtag: '"etag"', writeHttpMetadata() {},
      customMetadata: { userId: "user-1", ...(clientId ? { clientId } : {}) },
    });
    const response = await scoped.request(`/api/assets/${clientId ? `${clientId}/` : ""}user-1/image/photo`);
    expect(response.status).toBe(200);
    expect(r2.get).toHaveBeenLastCalledWith(`uploads/${clientId ? `${clientId}/` : ""}user-1/images/photo`);
  }
  r2.get.mockResolvedValue({ customMetadata: { userId: "user-1", clientId: "client-b" } });
  expect((await scoped.request("/api/assets/client-a/user-1/image/photo")).status).toBe(404);
});
