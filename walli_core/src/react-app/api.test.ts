import { afterEach, expect, it, vi } from "vitest";
import { clientBasicSettingsPatchSchema } from "@shared/client";
import { updateClientBasicSettings } from "./api";

afterEach(() => vi.unstubAllGlobals());

it.each(["week", "day"] as const)("saves basic settings with cleanup period %s in one request", async (autoDeletePeriod) => {
  const bodies: unknown[] = [];
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    expect(clientBasicSettingsPatchSchema.safeParse(body).success).toBe(true);
    return Response.json({
      basicSettings: { enabled: true, additionalSystemPrompt: "", autoDeletePeriod },
    });
  });
  vi.stubGlobal("fetch", fetch);
  const saved = await updateClientBasicSettings("client-1", {
    name: "web", enabled: true, additionalSystemPrompt: "", autoDeletePeriod,
  });
  expect(bodies[0]).toEqual({ name: "web", enabled: true, additionalSystemPrompt: "", autoDeletePeriod });
  expect(bodies).toHaveLength(1);
  expect(saved.basicSettings.enabled).toBe(true);
  expect(saved.basicSettings.autoDeletePeriod).toBe(autoDeletePeriod);
});
