import { hc, parseResponse } from "hono/client";
import type { AppType } from "../worker";

const apiClient = hc<AppType>("/", {
  init: {
    credentials: "include",
  },
});

const query =
  <TResponse extends Parameters<typeof parseResponse>[0]>(request: () => TResponse) =>
  () =>
    parseResponse(request());

export const getApiInfo = query(() => apiClient.api.index.$get());

export const getMe = query(() => apiClient.api.me.$get());

export const getAdminStatus = query(() => apiClient.api.admin.status.$get());

export const getSettings = query(() => apiClient.api.settings.$get());

export const updateSettings = (json: {
  systemPrompt: string;
  dialogSystemPrompt: string;
  dialogOpeningMessage: string;
}) => parseResponse(apiClient.api.admin.settings.$put({ json }));
