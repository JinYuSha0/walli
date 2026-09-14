import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InfiniteQueryObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { webChatConfigQuery, webChatHistoryQuery, webChatSessionsQuery } from "./web-chat-queries";
import { webChatRequest } from "./web-chat-api";

let client: QueryClient;
let requests: { url: string; signal?: AbortSignal | null; finish: (data: unknown) => void }[];
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
          requests.push({ url, signal, finish: (data) => resolve(Response.json(data)) });
        }),
    ),
  );
});
afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

async function remount(
  observer: {
    subscribe: (listener: () => void) => () => void;
    getCurrentResult: () => { isSuccess: boolean };
  },
  data: unknown,
) {
  const unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() => expect(requests).toHaveLength(1));
  unsubscribe(); // StrictMode cleanup, before the response arrives.
  const unsubscribeAgain = observer.subscribe(() => {});
  expect(requests).toHaveLength(1);
  expect(requests[0].signal?.aborted).not.toBe(true);
  requests[0].finish(data);
  await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));
  unsubscribeAgain();
  const finalUnsubscribe = observer.subscribe(() => {});
  expect(requests).toHaveLength(1); // Completed data is reused as well.
  finalUnsubscribe();
}

const config = { id: "client-a", slug: "support" };
it("reuses the config GET across development cleanup and remount", async () => {
  await remount(new QueryObserver(client, webChatConfigQuery(config.slug)), config);
});
it("reuses the session-list GET across cleanup and remount", async () => {
  await remount(new InfiniteQueryObserver(client, webChatSessionsQuery(config)), {
    sessions: [],
    nextCursor: null,
  });
});
it("reuses the history GET across cleanup and remount", async () => {
  await remount(new QueryObserver(client, webChatHistoryQuery(config, "session-a")), {
    messages: [],
    nextCursor: null,
  });
});
it("keeps rapidly switched sessions separate and reuses a pending request when switching back", async () => {
  const a = webChatHistoryQuery(config, "session-a");
  const b = webChatHistoryQuery(config, "session-b");
  const observer = new QueryObserver(client, a);
  const unsubscribe = observer.subscribe(() => {});
  observer.setOptions(b);
  observer.setOptions(a);
  expect(requests).toHaveLength(2);
  requests[1].finish({ session: { id: "session-b" }, messages: [], nextCursor: null });
  requests[0].finish({ session: { id: "session-a" }, messages: [], nextCursor: null });
  await vi.waitFor(() => expect(observer.getCurrentResult().data?.session?.id).toBe("session-a"));
  expect(client.getQueryData(b.queryKey)?.session?.id).toBe("session-b");
  unsubscribe();
});
it("isolates histories belonging to different authenticated users", async () => {
  const a = new QueryObserver(
    client,
    webChatHistoryQuery(config, "session-a", { userId: "a", token: "a-token" }),
  );
  const b = new QueryObserver(
    client,
    webChatHistoryQuery(config, "session-a", { userId: "b", token: "b-token" }),
  );
  const stopA = a.subscribe(() => {});
  const stopB = b.subscribe(() => {});
  expect(requests).toHaveLength(2);
  requests.forEach((request) => request.finish({ messages: [], nextCursor: null }));
  await vi.waitFor(() =>
    expect(a.getCurrentResult().isSuccess && b.getCurrentResult().isSuccess).toBe(true),
  );
  stopA();
  stopB();
});
it("still aborts a streaming request when explicitly stopped", async () => {
  const controller = new AbortController();
  const promise = webChatRequest(config.slug, "/sessions/session-a/messages", undefined, {
    method: "POST",
    signal: controller.signal,
  });
  const rejected = expect(promise).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await rejected;
  expect(requests[0].signal?.aborted).toBe(true);
});
