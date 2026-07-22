import { hc, parseResponse } from "hono/client";
import type { AppType } from "../worker";
import type {
  ClientAuthSettingsPatch,
  ClientBasicSettingsPatch,
  ClientConfigResponse,
  ClientCorsSettingsPatch,
  ClientDialogSettingsPatch,
  ClientPlatform,
  ClientUsageLimitPatch,
  TelegramSettingsPatch,
} from "../shared/client";
import type { SettingsPatch, SettingsResponse } from "../shared/const";

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
} from "../shared/client";

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
} from "../shared/const";

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
