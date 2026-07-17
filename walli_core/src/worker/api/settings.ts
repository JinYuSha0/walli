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
  DEFAULT_SETTINGS,
  SETTINGS_KEY_MAP,
  settingsFieldSchemaMap,
  settingsPatchSchema,
  settingsResponseSchema,
  settingsSchema,
  type Settings,
  type SettingsKey,
} from "../../shared/const";

const settingsKey = "settings";
const settingKeys = Object.keys(SETTINGS_KEY_MAP) as SettingsKey[];
const legacyGlobalPromptKey = "settings:system-prompt";
const legacySettingsSchema = settingsSchema.partial().passthrough();

const getLegacySettings = async (appKv: KVNamespace) => {
  const savedSettings = await appKv.get<unknown>(settingsKey, "json");
  const result = legacySettingsSchema.safeParse(savedSettings);

  if (!result.success) {
    return DEFAULT_SETTINGS;
  }

  const { systemPrompt, ...settings } = result.data as Partial<Settings> & {
    systemPrompt?: string;
  };

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    globalPrompt:
      settings.globalPrompt ?? systemPrompt ?? DEFAULT_SETTINGS.globalPrompt,
  };
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

const getSettings = async (appKv: KVNamespace) => {
  const legacySettings = await getLegacySettings(appKv);
  const entries = await Promise.all(
    settingKeys.map(async (settingKey) => {
      const storedValue = await appKv.get(SETTINGS_KEY_MAP[settingKey]);
      const value =
        storedValue ??
        (settingKey === "globalPrompt"
          ? await appKv.get(legacyGlobalPromptKey)
          : null);
      const result = settingsFieldSchemaMap[settingKey].safeParse(
        parseStoredSetting(value),
      );

      return [
        settingKey,
        result.success ? result.data : legacySettings[settingKey],
      ] as const;
    }),
  );

  return Object.fromEntries(entries) as Settings;
};

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

    return c.json(parseResponse(settingsResponseSchema, settings));
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

    await Promise.all(
      Object.entries(result.data).map(([settingKey, value]) =>
        c.env.APP_KV.put(
          SETTINGS_KEY_MAP[settingKey as SettingsKey],
          JSON.stringify(value),
        ),
      ),
    );

    const settings = await getSettings(c.env.APP_KV);

    return c.json(parseResponse(settingsResponseSchema, settings));
  });
