import { hc, parseResponse } from "hono/client";
import type { AppType } from "@worker/index";
import type {
  ClientAuthSettingsPatch,
  ClientBasicSettingsPatch,
  ClientConfigResponse,
  ClientCorsSettingsPatch,
  ClientDialogSettingsPatch,
  ClientPlatform,
  ClientUsageLimitPatch,
  TelegramSettingsPatch,
  TelegramWhitelistCreate,
  TelegramWhitelistEntry,
  TelegramWhitelistListResponse,
  TelegramWhitelistType,
} from "@shared/client";
import type { SettingsPatch, SettingsResponse } from "@shared/const";

export type {
  ClientConfigResponse,
  ClientAuthSettings,
  ClientAuthSettingsPatch,
  ClientBasicSettings,
  ClientBasicSettingsPatch,
  ClientCorsSettings,
  ClientCorsSettingsPatch,
  ClientDialogSettings,
  ClientDialogSettingsPatch,
  ClientPlatform,
  ClientUsageLimit,
  ClientUsageLimitPatch,
  TelegramSettingsPatch,
  TelegramWhitelistCreate,
  TelegramWhitelistEntry,
  TelegramWhitelistListResponse,
  TelegramWhitelistType,
} from "@shared/client";

export type {
  ModelCapabilityTag,
  ModelConfig,
  Settings,
  SettingsPatch,
  SettingsResponse,
  ToolApiInvocation,
  ToolConfig,
  ToolInvocation,
  ToolModelInvocation,
  ToolSchemaField,
  ToolSchemaFieldType,
} from "@shared/const";

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

export type UploadedAsset = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
};

export type UploadProgressCallback = (progress: number) => void;

export type ChatHistoryMessage = {
  id: string;
  role: "assistant" | "user";
  markdown: string;
};

export type ChatHistoryPage = {
  sessionId: string;
  title: string;
  messages: ChatHistoryMessage[];
  nextCursor: number | null;
};

export const getChatHistory = async (
  sessionId: string,
  cursor?: number,
  limit = 30,
  signal?: AbortSignal,
): Promise<ChatHistoryPage> => {
  const search = new URLSearchParams({ limit: String(limit), sessionId });
  if (cursor !== undefined) search.set("cursor", String(cursor));

  const response = await fetch(`/api/internal/chat/history?${search}`, {
    credentials: "include",
    signal,
  });
  const payload = (await response.json().catch(() => undefined)) as
    | ChatHistoryPage
    | { error?: unknown }
    | undefined;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Loading chat history failed (${response.status})`,
    );
  }

  return payload as ChatHistoryPage;
};

export const deleteChatSession = async (sessionId: string): Promise<void> => {
  const search = new URLSearchParams({ sessionId });
  const response = await fetch(`/api/internal/chat/session?${search}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      | { error?: unknown }
      | undefined;
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Deleting chat session failed (${response.status})`,
    );
  }
};

export const transcribeAudio = async (audio: Blob, signal?: AbortSignal): Promise<string> => {
  const form = new FormData();
  form.set("audio", audio, "recording.webm");
  const response = await fetch("/api/internal/transcribe", {
    body: form,
    credentials: "include",
    method: "POST",
    signal,
  });
  const payload = (await response.json().catch(() => undefined)) as
    | { error?: unknown; text?: unknown }
    | undefined;

  if (!response.ok || typeof payload?.text !== "string") {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Transcription failed (${response.status})`,
    );
  }

  return payload.text;
};

export const uploadAsset = (
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<UploadedAsset> => {
  const formData = new FormData();
  formData.set("file", file);
  const kind = file.type.startsWith("image/") ? "image" : "file";

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/upload/${kind}`);
    request.withCredentials = true;

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(100, Math.max(0, (event.loaded / event.total) * 100)));
    });

    request.addEventListener("load", () => {
      let payload: UploadedAsset | { error?: unknown } | undefined;
      try {
        payload = JSON.parse(request.responseText) as UploadedAsset | { error?: unknown };
      } catch {
        payload = undefined;
      }

      if (request.status < 200 || request.status >= 300) {
        reject(
          new Error(
            payload && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : `Upload failed (${request.status})`,
          ),
        );
        return;
      }
      if (!payload || !("url" in payload) || typeof payload.url !== "string") {
        reject(new Error("Upload response did not include a file URL"));
        return;
      }

      onProgress?.(100);
      resolve(payload as UploadedAsset);
    });
    request.addEventListener("error", () => reject(new Error("Upload failed (network error)")));
    request.addEventListener("abort", () => reject(new Error("Upload was aborted")));
    request.send(formData);
  });
};

export const getSettings = async (): Promise<SettingsResponse> =>
  parseResponse(apiClient.api.settings.$get());

export const updateSettings = async (json: SettingsPatch): Promise<SettingsResponse> =>
  parseResponse(apiClient.api.admin.settings.$patch({ json }));

export const resetSettings = async (): Promise<SettingsResponse> =>
  parseResponse(apiClient.api.admin.settings.$delete());

export const getClientConfig = async (
  platform: ClientPlatform,
): Promise<ClientConfigResponse> =>
  parseResponse(apiClient.api.admin.clients[":platform"].$get({ param: { platform } }));

export const resetClientSettings = async (
  platform: ClientPlatform,
): Promise<ClientConfigResponse> =>
  parseResponse(
    apiClient.api.admin.clients[":platform"]["reset-settings"].$post({
      param: { platform },
    }),
  );

const patchClientConfig = async (
  platform: ClientPlatform,
  json:
    | ClientAuthSettingsPatch
    | ClientBasicSettingsPatch
    | ClientCorsSettingsPatch
    | ClientDialogSettingsPatch
    | ClientUsageLimitPatch
    | TelegramSettingsPatch,
): Promise<ClientConfigResponse> => {
  const patchClient = apiClient.api.admin.clients[":platform"].$patch as (
    args: {
      param: { platform: ClientPlatform };
      json: typeof json;
    },
  ) => ReturnType<typeof apiClient.api.admin.clients[":platform"]["$patch"]>;

  return parseResponse(
    patchClient({
      param: { platform },
      json,
    }),
  );
};

export const updateClientBasicSettings = async (
  platform: ClientPlatform,
  json: ClientBasicSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(platform, json);

export const updateClientDialogSettings = async (
  platform: ClientPlatform,
  json: ClientDialogSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(platform, json);

export const updateClientAuthSettings = async (
  platform: ClientPlatform,
  json: ClientAuthSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(platform, json);

export const updateClientCorsSettings = async (
  json: ClientCorsSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig("web", json);

export const updateClientUsageLimit = async (
  platform: ClientPlatform,
  json: ClientUsageLimitPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(platform, json);

export const updateTelegramSettings = async (
  json: TelegramSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig("telegram", json);

export const getTelegramWhitelistEntries = async ({
  page,
  pageSize,
  type,
}: {
  page: number;
  pageSize: number;
  type?: TelegramWhitelistType;
}): Promise<TelegramWhitelistListResponse> => {
  const query = {
    page: String(page),
    pageSize: String(pageSize),
    ...(type ? { type } : {}),
  };

  return parseResponse(apiClient.api.admin.telegram.whitelist.$get({ query }));
};

export const createTelegramWhitelistEntry = async (
  json: TelegramWhitelistCreate,
): Promise<TelegramWhitelistEntry> =>
  parseResponse(apiClient.api.admin.telegram.whitelist.$post({ json }));

export const deleteTelegramWhitelistEntry = async ({
  type,
  id,
}: {
  type: TelegramWhitelistType;
  id: string;
}) => {
  await parseResponse(
    apiClient.api.admin.telegram.whitelist[":type"][":id"].$delete({
      param: {
        type,
        id,
      },
    }),
  );
};
