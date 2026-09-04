import { describe, expect, it, vi } from "vitest";
import { runWithChatAsyncContext } from "../lib/async-context";
import { scheduledTaskToolRoute } from "./tool-scheduled-task";

describe("scheduled task request context", () => {
  it("inherits identity and session without executor injection", async () => {
    const createTask = vi.fn(async (input) => input);
    const getByName = vi.fn(() => ({ createTask }));
    const response = await runWithChatAsyncContext({
      env: { USER_DO: { getByName } } as unknown as Env,
      origin: "https://test.local",
      sessionId: "session-1",
      userInfo: {
        userId: "user-1",
        clientId: "client-1",
        notificationChannel: { clientId: "client-1", type: "telegram", userId: "user-1" },
      },
    }, () => scheduledTaskToolRoute.request("/api/tools/scheduled-tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create", userId: "user-1", description: "Reminder", delayMs: 10000,
        clientId: "wrong-client", clientPlatform: "web",
      }),
    }));
    expect(response.status).toBe(201);
    expect(getByName).toHaveBeenCalledWith("client-1:telegram:user-1");
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-1" }));
  });
});
