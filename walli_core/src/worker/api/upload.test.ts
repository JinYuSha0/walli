import { beforeEach, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppBindings } from "./types";
const r2 = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn() }));
vi.mock("@worker/lib/async-context", () => ({ getAsyncContext: () => ({ env: { R2: r2 } }) }));
vi.mock("./helper/auth", () => ({ hasAdminRole: (user: { role: string }) => user.role === "admin" }));
vi.mock("../utils/llm", () => ({ hasValidTemporaryAssetUrl: vi.fn() }));
import { uploadRoute } from "./upload";
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
