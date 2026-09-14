import { hc, parseResponse } from "hono/client";
import type { AppType } from "@worker/index";
import type {
  ClientAuthSettingsPatch,
  ClientBasicSettingsPatch,
  ClientWebSettings,
  ClientConfigResponse,
  ClientCorsSettingsPatch,
  ClientDialogSettingsPatch,
  Client,
  ClientCreate,
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
  ClientWebSettings,
  ClientCorsSettings,
  ClientCorsSettingsPatch,
  ClientDialogSettings,
  ClientDialogSettingsPatch,
  ClientPlatform,
  Client,
  ClientCreate,
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

export const getSettings = async (): Promise<SettingsResponse> =>
  parseResponse(apiClient.api.settings.$get());

export const updateSettings = async (json: SettingsPatch): Promise<SettingsResponse> =>
  parseResponse(apiClient.api.admin.settings.$patch({ json }));

export const resetSettings = async (): Promise<SettingsResponse> =>
  parseResponse(apiClient.api.admin.settings.$delete());

export const getClients = async (): Promise<Client[]> =>
  parseResponse(apiClient.api.admin.clients.$get());

export const createClient = async (json: ClientCreate): Promise<ClientConfigResponse> => {
  const response = await apiClient.api.admin.clients.$post({ json });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to create client",
    );
  }
  return parseResponse(Promise.resolve(response));
};

export const getClientConfig = async (clientId: string): Promise<ClientConfigResponse> =>
  parseResponse(apiClient.api.admin.clients[":clientId"].$get({ param: { clientId } }));

export const deleteClient = async (clientId: string): Promise<void> => {
  const response = await apiClient.api.admin.clients[":clientId"].$delete({
    param: { clientId },
  });
  if (!response.ok) throw new Error("Failed to delete client");
};

const patchClientConfig = async (
  clientId: string,
  json:
    | ClientAuthSettingsPatch
    | ClientWebSettings
    | ClientBasicSettingsPatch
    | ClientCorsSettingsPatch
    | ClientDialogSettingsPatch
    | ClientUsageLimitPatch
    | TelegramSettingsPatch,
): Promise<ClientConfigResponse> => {
  const patchClient = apiClient.api.admin.clients[":clientId"].$patch as (
    args: {
      param: { clientId: string };
      json: typeof json;
    },
  ) => ReturnType<typeof apiClient.api.admin.clients[":clientId"]["$patch"]>;

  return parseResponse(
    patchClient({
      param: { clientId },
      json,
    }),
  );
};

export const updateClientBasicSettings = async (
  clientId: string,
  json: ClientBasicSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(clientId, json);

export const updateClientDialogSettings = async (
  clientId: string,
  json: ClientDialogSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(clientId, json);

export const updateClientAuthSettings = async (
  clientId: string,
  json: ClientAuthSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(clientId, json);

export const updateClientCorsSettings = async (
  clientId: string,
  json: ClientCorsSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(clientId, json);

export const updateClientUsageLimit = async (
  clientId: string,
  json: ClientUsageLimitPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(clientId, json);

export const updateTelegramSettings = async (
  clientId: string,
  json: TelegramSettingsPatch,
): Promise<ClientConfigResponse> =>
  patchClientConfig(clientId, json);

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

export const uploadAssistantAvatar = async (file: File): Promise<string> => {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/admin/assistant-avatar", { method: "POST", body: form });
  if (!response.ok) throw new Error("Avatar upload failed");
  const result = await response.json() as { url: string };
  return result.url;
};

export const updateClientWebSettings = (clientId: string, json: ClientWebSettings) => patchClientConfig(clientId, json);
