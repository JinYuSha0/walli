import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { hasAdminRole } from "./auth";
import type { AppBindings } from "./types";
import {
  emptyQuerySchema,
  errorResponseSchema,
  parseResponse,
  validateQuery,
} from "./validation";
import {
  BUILT_IN_TOOLS,
  DEFAULT_SETTINGS,
  SETTINGS_KV_KEY,
  SETTINGS_KEY_MAP,
  settingsBaseSchema,
  settingsFieldSchemaMap,
  settingsPatchSchema,
  settingsResponseSchema,
  timeZoneConfigSchema,
  type Settings,
  type SettingsKey,
} from "../../shared/const";

const settingKeys = Object.keys(SETTINGS_KEY_MAP) as SettingsKey[];
const legacyGlobalPromptKey = "settings:system-prompt";
const legacyUsageLimitsKey = "settings:usage-limits";
const legacySettingsSchema = settingsBaseSchema.partial().loose();
const builtInToolNames = new Set(BUILT_IN_TOOLS.map((tool) => tool.name));

const normalizeBuiltInTools = (settings: Settings) => {
  const configuredBuiltIns = new Map(
    [...settings.builtInTools, ...settings.tools.filter((tool) => builtInToolNames.has(tool.name))]
      .map((tool) => [tool.name, tool]),
  );

  return BUILT_IN_TOOLS.map((defaultTool) => {
    const configuredTool = configuredBuiltIns.get(defaultTool.name);

    if (!configuredTool) {
      return defaultTool;
    }

    return {
      ...configuredTool,
      name: defaultTool.name,
    };
  });
};

const normalizeSettings = (settings: Settings): Settings => ({
  ...settings,
  builtInTools: normalizeBuiltInTools(settings),
  tools: settings.tools.filter((tool) => !builtInToolNames.has(tool.name)),
});

const getPrimaryModelUsageLimit = (settings: Partial<Settings>) => {
  const usageLimits = (
    settings as Partial<Settings> & {
      usageLimits?: Array<{
        model: string;
        perRequestInputLimit: number;
        perRequestOutputLimit?: number;
        perUserDailyInputLimit: number;
        perUserDailyOutputLimit: number;
      }>;
    }
  ).usageLimits;
  const primaryModel = settings.primaryModel ?? DEFAULT_SETTINGS.primaryModel;
  const legacyLimit = usageLimits?.find((limit) => limit.model === primaryModel);

  if (!legacyLimit) {
    return DEFAULT_SETTINGS.primaryModelUsageLimit;
  }

  return {
    dailyInputLimit: legacyLimit.perUserDailyInputLimit,
    dailyOutputLimit: legacyLimit.perUserDailyOutputLimit,
  };
};

const getLegacyPrimaryModelUsageLimit = (settings: Partial<Settings> | unknown) => {
  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
    return undefined;
  }

  const record = settings as Record<string, unknown>;
  const primaryModelUsageLimit = record.primaryModelUsageLimit;

  if (
    typeof primaryModelUsageLimit === "object" &&
    primaryModelUsageLimit !== null &&
    !Array.isArray(primaryModelUsageLimit)
  ) {
    return primaryModelUsageLimit as Record<string, unknown>;
  }

  return undefined;
};

const getLegacyTimeZone = (settings: Partial<Settings> | unknown) => {
  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
    return DEFAULT_SETTINGS.timeZone;
  }

  const record = settings as Record<string, unknown>;
  const timeZone =
    record.timeZone ?? getLegacyPrimaryModelUsageLimit(settings)?.timeZone;
  const result = timeZoneConfigSchema.safeParse(timeZone);

  return result.success ? result.data : DEFAULT_SETTINGS.timeZone;
};

const getLegacySettings = async (appKv: KVNamespace) => {
  const savedSettings = await appKv.get<unknown>(SETTINGS_KV_KEY, "json");
  const result = legacySettingsSchema.safeParse(savedSettings);

  if (!result.success) {
    return normalizeSettings(DEFAULT_SETTINGS);
  }

  const { systemPrompt, ...settings } = result.data as Partial<Settings> & {
    systemPrompt?: string;
  };

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    primaryModelUsageLimit:
      settings.primaryModelUsageLimit ?? getPrimaryModelUsageLimit(settings),
    timeZone: settings.timeZone ?? getLegacyTimeZone(savedSettings),
    globalPrompt:
      settings.globalPrompt ?? systemPrompt ?? DEFAULT_SETTINGS.globalPrompt,
  };
};

const getFullStoredSettings = async (appKv: KVNamespace) => {
  const savedSettings = await appKv.get<unknown>(SETTINGS_KV_KEY, "json");
  const settingsWithMigratedTimeZone =
    typeof savedSettings === "object" &&
    savedSettings !== null &&
    !Array.isArray(savedSettings) &&
    !("timeZone" in savedSettings)
      ? {
          ...savedSettings,
          timeZone: getLegacyTimeZone(savedSettings),
        }
      : savedSettings;
  const result = settingsBaseSchema.safeParse(settingsWithMigratedTimeZone);

  return result.success ? normalizeSettings(result.data) : undefined;
};

const parseStoredSetting = (value: string | null) => {
  if (value === null) {
    return undefined;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

export const getSettings = async (appKv: KVNamespace) => {
  const fullStoredSettings = await getFullStoredSettings(appKv);

  if (fullStoredSettings) {
    return fullStoredSettings;
  }

  const legacySettings = await getLegacySettings(appKv);
  const entries = await Promise.all(
    settingKeys.map(async (settingKey) => {
      const storedValue = await appKv.get(SETTINGS_KEY_MAP[settingKey]);
      const value =
        storedValue ??
        (settingKey === "globalPrompt"
          ? await appKv.get(legacyGlobalPromptKey)
          : settingKey === "primaryModelUsageLimit"
            ? await appKv.get(legacyUsageLimitsKey)
            : null);
      const parsedValue = parseStoredSetting(value);
      const settingValue =
        settingKey === "timeZone" && parsedValue === undefined
          ? getLegacyTimeZone(legacySettings)
          : settingKey === "primaryModelUsageLimit" && Array.isArray(parsedValue)
          ? getPrimaryModelUsageLimit({
              ...legacySettings,
              usageLimits: parsedValue,
            } as Partial<Settings> & { usageLimits: typeof parsedValue })
          : parsedValue;
      const result = settingsFieldSchemaMap[settingKey].safeParse(
        settingValue,
      );

      return [
        settingKey,
        result.success ? result.data : legacySettings[settingKey],
      ] as const;
    }),
  );

  const settings = normalizeSettings(Object.fromEntries(entries) as Settings);

  await appKv.put(SETTINGS_KV_KEY, JSON.stringify(settings));

  return settings;
};

const maskApiToken = (token: string | undefined) => {
  const value = token?.trim() ?? "";

  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 4)}${"*".repeat(Math.max(value.length - 8, 4))}${value.slice(-4)}`;
};

const createSettingsResponse = (settings: Settings, env: Env) =>
  parseResponse(settingsResponseSchema, {
    ...settings,
    apiTokenMask: maskApiToken(env.API_TOKEN),
  });

const requireAdmin: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json(parseResponse(errorResponseSchema, { error: "Unauthorized" }), 401);
  }

  if (!hasAdminRole(user, c.env)) {
    return c.json(
      parseResponse(errorResponseSchema, { error: "Forbidden", requiredRole: "admin" }),
      403,
    );
  }

  await next();
};

export const settingsRoute = new Hono<AppBindings>()
  .get("/api/settings", validateQuery(emptyQuerySchema), async (c) => {
    const settings = await getSettings(c.env.APP_KV);

    return c.json(createSettingsResponse(settings, c.env));
  })
  .use("/api/admin/settings", requireAdmin)
  .patch("/api/admin/settings", async (c) => {
    const result = settingsPatchSchema.safeParse(await c.req.json().catch(() => null));

    if (!result.success) {
      return c.json(
        {
          error: "Invalid body",
          issues: z.treeifyError(result.error),
        },
        400,
      );
    }

    const settings = normalizeSettings({
      ...(await getSettings(c.env.APP_KV)),
      ...result.data,
    });

    await c.env.APP_KV.put(SETTINGS_KV_KEY, JSON.stringify(settings));

    return c.json(createSettingsResponse(settings, c.env));
  });
