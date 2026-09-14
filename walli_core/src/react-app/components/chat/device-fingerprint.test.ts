import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it("retains identity across reloads and screen changes", async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) });
  const first = await (await import("./device-fingerprint")).getDeviceFingerprint();
  vi.resetModules();
  vi.stubGlobal("screen", { width: 720, height: 1280, colorDepth: 24 });
  expect(await (await import("./device-fingerprint")).getDeviceFingerprint()).toBe(first);
});
it("keeps identical screens separate and works without storage", async () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Unavailable"); }, setItem: () => { throw new Error("Unavailable"); } });
  vi.stubGlobal("screen", { width: 1920, height: 1080, colorDepth: 24 });
  const { getDeviceFingerprint } = await import("./device-fingerprint");
  const first = await getDeviceFingerprint();
  expect(await getDeviceFingerprint()).toBe(first);
  vi.resetModules();
  expect(await (await import("./device-fingerprint")).getDeviceFingerprint()).not.toBe(first);
});
