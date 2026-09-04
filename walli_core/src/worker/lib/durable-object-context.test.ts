import { describe, expect, it } from "vitest";
import { WithAsyncContext } from "./durable-object-context";
import { extendChatAsyncContext, getAsyncContext } from "./async-context";

const initialize = Symbol("initialize");

class Example {
  readonly env: Env;
  readonly ctx = {} as DurableObjectState;
  readonly initialized: Promise<string>;

  constructor(token: string) {
    this.env = { API_TOKEN: token } as Env;
    this.initialized = this[initialize]();
  }

  private async [initialize]() {
    await Promise.resolve();
    return this.read().env.API_TOKEN;
  }

  read() { return getAsyncContext(); }

  async nested(sessionId: string, other?: Example) {
    return extendChatAsyncContext({ sessionId }, async () => {
      await Promise.resolve();
      const nested = this.read();
      const foreign = other?.read();
      return { nested, foreign, restored: this.read() };
    });
  }

  fail() { throw new Error("expected failure"); }
}

WithAsyncContext(Example);

describe("class async context", () => {
  it("covers symbol initialization and keeps RPC methods on the prototype", async () => {
    const instance = new Example("first");
    expect(await instance.initialized).toBe("first");
    expect(Object.hasOwn(instance, "read")).toBe(false);
    expect(instance.read().env).toBe(instance.env);
    expect(() => getAsyncContext()).toThrow();
  });

  it("preserves nested context, isolates instances, and restores the caller", async () => {
    const first = new Example("first");
    const second = new Example("second");
    const { nested, foreign, restored } = await first.nested("task", second);
    expect(nested.sessionId).toBe("task");
    expect(foreign?.env).toBe(second.env);
    expect(foreign?.sessionId).toBeUndefined();
    expect(restored).toBe(nested);
  });

  it("isolates concurrent calls on the same instance", async () => {
    const instance = new Example("first");
    const results = await Promise.all([instance.nested("one"), instance.nested("two")]);
    expect(results.map(({ nested }) => nested.sessionId)).toEqual(["one", "two"]);
    expect(instance.read().sessionId).toBeUndefined();
  });

  it("preserves synchronous exceptions and unwinds context", () => {
    const instance = new Example("first");
    expect(() => instance.fail()).toThrow("expected failure");
    expect(() => getAsyncContext()).toThrow();
  });
});
