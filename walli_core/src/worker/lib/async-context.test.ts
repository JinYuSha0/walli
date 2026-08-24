import { describe, expect, it } from "vitest";
import {
  bindChatAsyncContext,
  getChatAsyncContext,
  runWithChatAsyncContext,
} from "./async-context";

const createContext = (origin: string) => ({
  env: {} as Env,
  origin,
});

describe("chat async context", () => {
  it("keeps concurrent chat executions isolated", async () => {
    const readOrigin = (origin: string) =>
      runWithChatAsyncContext(createContext(origin), async () => {
        await Promise.resolve();
        return getChatAsyncContext().origin;
      });

    await expect(
      Promise.all([readOrigin("https://first.test"), readOrigin("https://second.test")]),
    ).resolves.toEqual(["https://first.test", "https://second.test"]);
  });

  it("binds deferred tool execution to the context where the tool was created", async () => {
    const readOrigin = runWithChatAsyncContext(createContext("https://chat.test"), () =>
      bindChatAsyncContext(async () => {
        await Promise.resolve();
        return getChatAsyncContext().origin;
      }));

    await expect(readOrigin()).resolves.toBe("https://chat.test");
  });
});
