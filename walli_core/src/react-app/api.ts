import { hc, parseResponse } from "hono/client";
import type { AppType } from "../worker";
import type { SettingsPatch, SettingsResponse } from "../shared/const";

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
