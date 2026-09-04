import { AsyncLocalStorage } from "node:async_hooks";
import { runWithChatAsyncContext } from "./async-context";

const contextOwner = new AsyncLocalStorage<object>();

type ContextHost = {
  readonly env: Env;
  readonly ctx: DurableObjectState;
};

/**
 * Wrap own prototype methods without changing Cloudflare's RPC method discovery.
 * Call once after the class declaration. Keep entrypoints as methods, not arrow
 * fields/getters. Constructor work needing context must call a wrapped method.
 * Task context belongs in extendChatAsyncContext(), never on the instance.
 */
export function WithAsyncContext<T extends { prototype: object }>(target: T): T {
  for (const key of Reflect.ownKeys(target.prototype)) {
    if (key === "constructor") continue;
    const descriptor = Object.getOwnPropertyDescriptor(target.prototype, key);
    if (!descriptor || typeof descriptor.value !== "function") continue;
    const method = descriptor.value as (this: ContextHost, ...args: unknown[]) => unknown;

    Object.defineProperty(target.prototype, key, {
      ...descriptor,
      value: function (this: ContextHost, ...args: unknown[]) {
        // Nested calls on this instance must retain task-specific user/session context.
        if (contextOwner.getStore() === this) return method.apply(this, args);
        return contextOwner.run(this, () => runWithChatAsyncContext(
          { env: this.env, ctx: this.ctx, origin: "https://internal.local" },
          () => method.apply(this, args),
        ));
      },
    });
  }
  return target;
}
