import { AsyncLocalStorage } from "node:async_hooks";
import type { BackgroundExecutionContext } from "../utils/common";
import type { ChatUserInfo } from "./chat-runner";

export type ChatAsyncContext = {
  env: Env;
  origin: string;
  ctx?: BackgroundExecutionContext;
  sessionId?: string;
  userInfo?: ChatUserInfo;
};

const chatAsyncContext = new AsyncLocalStorage<ChatAsyncContext>();

export const runWithChatAsyncContext = <Result>(
  context: ChatAsyncContext,
  callback: () => Result,
): Result => chatAsyncContext.run(context, callback);

export const extendChatAsyncContext = <Result>(
  context: Partial<ChatAsyncContext>,
  callback: () => Result,
): Result => runWithChatAsyncContext({ ...getAsyncContext(), ...context }, callback);

export const getAsyncContext = (): ChatAsyncContext => {
  const context = chatAsyncContext.getStore();

  if (!context) {
    throw new Error("Chat async context is not available");
  }

  return context;
};

export const bindAsyncContext = <Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
) => AsyncLocalStorage.bind(callback);
