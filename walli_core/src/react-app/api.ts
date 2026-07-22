import { hc, parseResponse } from "hono/client";
import type { AppType } from "../worker";
import type {
  ClientConfigResponse,
  ClientDialogSettingsPatch,
  ClientPlatform,
  ClientUsageLimitPatch,
  TelegramSettingsPatch,
} from "../shared/client";
import type { SettingsPatch, SettingsResponse } from "../shared/const";

export type {
  ClientConfigResponse,
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

export const updateClientDialogSettings = async (
  platform: ClientPlatform,
  json: ClientDialogSettingsPatch,
): Promise<ClientConfigResponse> =>
  parseResponse(
    apiClient.api.admin.clients[":platform"].$patch({
      param: { platform },
      json,
    }),
  );

export const updateClientUsageLimit = async (
  platform: ClientPlatform,
  json: ClientUsageLimitPatch,
): Promise<ClientConfigResponse> =>
  parseResponse(
    apiClient.api.admin.clients[":platform"].$patch({
      param: { platform },
      json,
    }),
  );

export const updateTelegramSettings = async (
  json: TelegramSettingsPatch,
): Promise<ClientConfigResponse> =>
  parseResponse(
    apiClient.api.admin.clients[":platform"].$patch({
      param: { platform: "telegram" },
      json,
    }),
  );
