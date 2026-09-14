import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
  webChatJson,
  type WebChatConfig,
  type WebCredentials,
  type WebHistory,
  type WebSessionsPage,
} from "./web-chat-api";

// These bounded GETs belong to the query cache, not to a component mount.
// Do not consume the observer AbortSignal: StrictMode re-subscriptions and
// session navigation must reuse in-flight reads instead of aborting/restarting.
// Streaming and user-controlled operations still pass their own AbortSignal.
const readOptions = { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } as const;

export const webChatConfigQuery = (slug: string) =>
  queryOptions({
    ...readOptions,
    queryKey: ["web-chat-config", slug],
    refetchOnWindowFocus: "always",
    queryFn: () => webChatJson<WebChatConfig>(slug, "/config"),
  });

export const webChatSessionsQuery = (
  config: Pick<WebChatConfig, "id" | "slug">,
  credentials?: WebCredentials,
) =>
  infiniteQueryOptions({
    ...readOptions,
    queryKey: ["web-chat-sessions", config.id, credentials?.userId ?? "visitor"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      webChatJson<WebSessionsPage>(
        config.slug,
        `/sessions${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`,
        credentials,
      ),
    getNextPageParam: (page) => page.nextCursor,
  });

export const webChatHistoryQuery = (
  config: Pick<WebChatConfig, "id" | "slug">,
  sessionId: string | undefined,
  credentials?: WebCredentials,
) =>
  queryOptions({
    ...readOptions,
    queryKey: ["web-chat-history", config.id, credentials?.userId, sessionId],
    enabled: !!sessionId,
    queryFn: () => {
      if (!sessionId) throw new Error("Session ID is required");
      return webChatJson<WebHistory>(
        config.slug,
        `/sessions/${encodeURIComponent(sessionId)}`,
        credentials,
      );
    },
  });
