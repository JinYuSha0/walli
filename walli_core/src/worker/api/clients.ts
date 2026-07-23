import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "@worker/db/client";
import { telegramWhitelistUser } from "@worker/db/schema";
import type { AppBindings } from "./types";
import { requireAdmin } from "./helper/middleware";
import {
  CLIENT_PLATFORMS,
  clientAuthSettingsPatchSchema,
  clientAuthSettingsSchema,
  clientBasicSettingsPatchSchema,
  clientBasicSettingsSchema,
  clientCorsSettingsPatchSchema,
  clientCorsSettingsSchema,
  clientDialogSettingsPatchSchema,
  clientDialogSettingsSchema,
  clientConfigResponseSchema,
  clientPlatformSchema,
  clientUsageLimitPatchSchema,
  clientUsageLimitSchema,
  telegramSettingsPatchSchema,
  telegramSettingsSchema,
  type ClientAuthSettings,
  type ClientBasicSettings,
  type ClientCorsSettings,
  type ClientDialogSettings,
  type ClientPlatform,
  type ClientUsageLimit,
  type TelegramSettings,
  type TelegramSettingsPatch,
} from "@shared/client";
import { getSettings } from "./settings";
import { errorResponseSchema, parseResponse } from "./helper/validation";

const clientConfigKey = (platform: ClientPlatform) => `client:${platform}:client-id`;

const clientBasicSettingsKey = (platform: ClientPlatform) => `client:${platform}:basic-settings`;

const clientDialogSettingsKey = (platform: ClientPlatform) => `client:${platform}:dialog-settings`;

const clientUsageLimitKey = (platform: ClientPlatform) => `client:${platform}:usage-limit`;

const clientAuthSettingsKey = (platform: ClientPlatform) => `client:${platform}:auth-settings`;

const webCorsSettingsKey = "client:web:cors-settings";

const telegramSettingsKey = "client:telegram:settings";

const createClientId = (platform: ClientPlatform) =>
  `${platform}_${crypto.randomUUID().replace(/-/g, "")}`;

export const getOrCreateClientId = async (appKv: KVNamespace, platform: ClientPlatform) => {
  const key = clientConfigKey(platform);
  const savedClientId = await appKv.get(key);
  const clientId = savedClientId ?? createClientId(platform);

  if (!savedClientId) {
    await appKv.put(key, clientId);
  }

  return clientId;
};

const defaultBasicSettings = {
  enabled: false,
  additionalSystemPrompt: "",
} satisfies ClientBasicSettings;

export const getClientBasicSettings = async (appKv: KVNamespace, platform: ClientPlatform) => {
  const savedSettings = await appKv.get(clientBasicSettingsKey(platform), "json");
  const result = clientBasicSettingsSchema.partial().safeParse(savedSettings);

  if (!result.success) {
    return defaultBasicSettings;
  }

  return {
    ...defaultBasicSettings,
    ...result.data,
  };
};

const getDefaultDialogSettings = async (appKv: KVNamespace): Promise<ClientDialogSettings> => {
  const settings = await getSettings(appKv);

  return {
    dialogSystemPrompt: settings.dialogSystemPrompt,
    dialogOpeningMessage: "",
    dialogInputMaxLength: 300,
    dialogPlaceholder: "",
    dialogSpeechEnabled: false,
    dialogImageEnabled: false,
  };
};

const getClientDialogSettings = async (appKv: KVNamespace, platform: ClientPlatform) => {
  const defaultDialogSettings = await getDefaultDialogSettings(appKv);
  const savedSettings = await appKv.get(clientDialogSettingsKey(platform), "json");
  const result = clientDialogSettingsSchema.partial().safeParse(savedSettings);

  if (!result.success) {
    return defaultDialogSettings;
  }

  return {
    ...defaultDialogSettings,
    ...result.data,
  };
};

const defaultUsageLimit = {
  perRequestInputLimit: 0,
  perRequestOutputLimit: 0,
  perUserDailyInputLimit: 0,
  perUserDailyOutputLimit: 0,
} satisfies ClientUsageLimit;

const getClientUsageLimit = async (appKv: KVNamespace, platform: ClientPlatform) => {
  const savedUsageLimit = await appKv.get(clientUsageLimitKey(platform), "json");
  const result = clientUsageLimitSchema.partial().safeParse(savedUsageLimit);

  if (!result.success) {
    return defaultUsageLimit;
  }

  return {
    ...defaultUsageLimit,
    ...result.data,
  };
};

const getDefaultAuthSettings = async (appKv: KVNamespace): Promise<ClientAuthSettings> => {
  const settings = await getSettings(appKv);

  return {
    authEnabled: settings.authEnabled,
    authEndpointUrl: settings.authEndpointUrl,
  };
};

export const getClientAuthSettings = async (appKv: KVNamespace, platform: ClientPlatform) => {
  const defaultAuthSettings = await getDefaultAuthSettings(appKv);
  const savedSettings = await appKv.get(clientAuthSettingsKey(platform), "json");
  const result = clientAuthSettingsSchema.partial().safeParse(savedSettings);

  if (!result.success) {
    return defaultAuthSettings;
  }

  return {
    ...defaultAuthSettings,
    ...result.data,
  };
};

const getDefaultCorsSettings = async (appKv: KVNamespace): Promise<ClientCorsSettings> => {
  const settings = await getSettings(appKv);

  return {
    corsAllowedOrigins: settings.corsAllowedOrigins,
  };
};

export const getWebCorsSettings = async (appKv: KVNamespace) => {
  const defaultCorsSettings = await getDefaultCorsSettings(appKv);
  const savedSettings = await appKv.get(webCorsSettingsKey, "json");
  const result = clientCorsSettingsSchema.partial().safeParse(savedSettings);

  if (!result.success) {
    return defaultCorsSettings;
  }

  return {
    ...defaultCorsSettings,
    ...result.data,
  };
};

export const getClientPlatformFromClientId = (clientId: string | undefined) => {
  const value = clientId?.trim() ?? "";
  const platform = CLIENT_PLATFORMS.find((clientPlatform) =>
    value.startsWith(`${clientPlatform}_`),
  );

  return platform;
};

export const maskSecret = (secret: string | undefined) => {
  const value = secret?.trim() ?? "";

  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 4)}${"*".repeat(Math.max(value.length - 8, 4))}${value.slice(-4)}`;
};

const defaultTelegramSettings = {
  botToken: "",
  accessPolicy: "public",
} satisfies TelegramSettings;

export const getTelegramSettings = async (appKv: KVNamespace) => {
  const savedSettings = await appKv.get(telegramSettingsKey, "json");
  const result = telegramSettingsSchema.partial().safeParse(savedSettings);

  if (!result.success) {
    return defaultTelegramSettings;
  }

  return {
    ...defaultTelegramSettings,
    ...result.data,
  };
};

export const getTelegramBotToken = async (appKv: KVNamespace, env: Env) => {
  const settings = await getTelegramSettings(appKv);

  return settings.botToken.trim() || env.TELEGRAM_BOT_TOKEN?.trim() || "";
};

const saveTelegramSettings = async (appKv: KVNamespace, patch: TelegramSettingsPatch) => {
  const currentSettings = await getTelegramSettings(appKv);
  const settingsPatch = {
    ...(patch.botToken === undefined ? {} : { botToken: patch.botToken }),
    ...(patch.accessPolicy === undefined ? {} : { accessPolicy: patch.accessPolicy }),
  } satisfies Partial<TelegramSettings>;
  const settings = {
    ...currentSettings,
    ...settingsPatch,
  };

  await appKv.put(telegramSettingsKey, JSON.stringify(settings));

  return settings;
};

const deleteTelegramWhitelistEntries = async (db: Database) => {
  await db.delete(telegramWhitelistUser).run();
};

const createTelegramSettingsResponse = (settings: TelegramSettings) => ({
  botTokenMask: maskSecret(settings.botToken),
  accessPolicy: settings.accessPolicy,
});

const getClientConfigResponse = async (env: Env, platform: ClientPlatform) => {
  const appKv = env.APP_KV;
  const clientId = await getOrCreateClientId(appKv, platform);
  const basicSettings = await getClientBasicSettings(appKv, platform);
  const authSettings = await getClientAuthSettings(appKv, platform);
  const usageLimit = await getClientUsageLimit(appKv, platform);

  if (platform === "telegram") {
    const telegramSettings = await getTelegramSettings(appKv);

    return parseResponse(clientConfigResponseSchema, {
      platform,
      clientId,
      basicSettings,
      authSettings,
      usageLimit,
      telegramSettings: createTelegramSettingsResponse(telegramSettings),
    });
  }

  const dialogSettings = await getClientDialogSettings(appKv, platform);

  if (platform === "web") {
    const corsSettings = await getWebCorsSettings(appKv);

    return parseResponse(clientConfigResponseSchema, {
      platform,
      clientId,
      basicSettings,
      authSettings,
      dialogSettings,
      corsSettings,
      usageLimit,
    });
  }

  return parseResponse(clientConfigResponseSchema, {
    platform,
    clientId,
    basicSettings,
    authSettings,
    dialogSettings,
    usageLimit,
  });
};

const resetClientSettings = async (appKv: KVNamespace, platform: ClientPlatform) => {
  const keys = [
    clientBasicSettingsKey(platform),
    clientAuthSettingsKey(platform),
    clientUsageLimitKey(platform),
  ];

  if (platform === "telegram") {
    keys.push(telegramSettingsKey);
  } else {
    keys.push(clientDialogSettingsKey(platform));
  }

  if (platform === "web") {
    keys.push(webCorsSettingsKey);
  }

  await Promise.all(keys.map((key) => appKv.delete(key)));
};

export const clientsRoute = new Hono<AppBindings>()
  .use("/api/admin/clients/*", requireAdmin)
  .get("/api/admin/clients/:platform", async (c) => {
    const platformResult = clientPlatformSchema.safeParse(c.req.param("platform"));

    if (!platformResult.success) {
      return c.json(
        {
          error: "Invalid platform",
          issues: z.treeifyError(platformResult.error),
        },
        400,
      );
    }

    return c.json(await getClientConfigResponse(c.env, platformResult.data));
  })
  .post("/api/admin/clients/:platform/reset-settings", async (c) => {
    const platformResult = clientPlatformSchema.safeParse(c.req.param("platform"));

    if (!platformResult.success) {
      return c.json(
        {
          error: "Invalid platform",
          issues: z.treeifyError(platformResult.error),
        },
        400,
      );
    }

    const platform = platformResult.data;
    await resetClientSettings(c.env.APP_KV, platform);
    if (platform === "telegram") {
      await deleteTelegramWhitelistEntries(c.get("db"));
    }

    return c.json(await getClientConfigResponse(c.env, platform));
  })
  .patch("/api/admin/clients/:platform", async (c) => {
    const platformResult = clientPlatformSchema.safeParse(c.req.param("platform"));

    if (!platformResult.success) {
      return c.json(
        {
          error: "Invalid platform",
          issues: z.treeifyError(platformResult.error),
        },
        400,
      );
    }

    const platform = platformResult.data;
    const body = await c.req.json().catch(() => null);
    const basicSettingsResult = clientBasicSettingsPatchSchema.safeParse(body);
    const authSettingsResult = clientAuthSettingsPatchSchema.safeParse(body);
    const corsSettingsResult = clientCorsSettingsPatchSchema.safeParse(body);
    const dialogSettingsResult = clientDialogSettingsPatchSchema.safeParse(body);
    const usageLimitResult = clientUsageLimitPatchSchema.safeParse(body);
    const telegramSettingsResult = telegramSettingsPatchSchema.safeParse(body);
    const isBasicSettingsPatch = basicSettingsResult.success;
    const isAuthSettingsPatch = authSettingsResult.success;
    const isCorsSettingsPatch = platform === "web" && corsSettingsResult.success;
    const isDialogSettingsPatch = dialogSettingsResult.success;
    const isUsageLimitPatch = usageLimitResult.success;
    const isTelegramSettingsPatch = platform === "telegram" && telegramSettingsResult.success;

    if (
      !isAuthSettingsPatch &&
      !isBasicSettingsPatch &&
      !isCorsSettingsPatch &&
      !isDialogSettingsPatch &&
      !isUsageLimitPatch &&
      !isTelegramSettingsPatch
    ) {
      return c.json(
        {
          error: "Invalid body",
          issues: {
            basicSettings: basicSettingsResult.success
              ? undefined
              : z.treeifyError(basicSettingsResult.error),
            authSettings: authSettingsResult.success
              ? undefined
              : z.treeifyError(authSettingsResult.error),
            corsSettings: corsSettingsResult.success
              ? undefined
              : z.treeifyError(corsSettingsResult.error),
            dialogSettings: dialogSettingsResult.success
              ? undefined
              : z.treeifyError(dialogSettingsResult.error),
            usageLimit: usageLimitResult.success
              ? undefined
              : z.treeifyError(usageLimitResult.error),
            telegramSettings: telegramSettingsResult.success
              ? undefined
              : z.treeifyError(telegramSettingsResult.error),
          },
        },
        400,
      );
    }

    const currentUsageLimit = await getClientUsageLimit(c.env.APP_KV, platform);
    const currentBasicSettings = await getClientBasicSettings(c.env.APP_KV, platform);
    const currentAuthSettings = await getClientAuthSettings(c.env.APP_KV, platform);
    const currentCorsSettings =
      platform === "web" ? await getWebCorsSettings(c.env.APP_KV) : undefined;
    const canPatchDialogSettings = platform !== "telegram" && isDialogSettingsPatch;
    const canPatchTelegramSettings = platform === "telegram" && isTelegramSettingsPatch;
    const basicSettingsPatch = isBasicSettingsPatch
      ? {
          ...basicSettingsResult.data,
          ...(basicSettingsResult.data.additionalSystemPrompt === undefined
            ? {}
            : {
                additionalSystemPrompt: basicSettingsResult.data.additionalSystemPrompt.trim(),
              }),
        }
      : undefined;
    const basicSettings = isBasicSettingsPatch
      ? {
          ...currentBasicSettings,
          ...basicSettingsPatch,
        }
      : currentBasicSettings;
    const authSettings = isAuthSettingsPatch
      ? {
          ...currentAuthSettings,
          ...authSettingsResult.data,
        }
      : currentAuthSettings;
    const corsSettings =
      isCorsSettingsPatch && currentCorsSettings
        ? {
            ...currentCorsSettings,
            ...corsSettingsResult.data,
          }
        : currentCorsSettings;
    const usageLimit = isUsageLimitPatch
      ? {
          ...currentUsageLimit,
          ...usageLimitResult.data,
        }
      : currentUsageLimit;

    let dialogSettings: ClientDialogSettings | undefined;
    if (platform !== "telegram") {
      const currentDialogSettings = await getClientDialogSettings(c.env.APP_KV, platform);
      dialogSettings = isDialogSettingsPatch
        ? {
            ...currentDialogSettings,
            ...dialogSettingsResult.data,
          }
        : currentDialogSettings;
    }

    await Promise.all([
      isBasicSettingsPatch
        ? c.env.APP_KV.put(clientBasicSettingsKey(platform), JSON.stringify(basicSettings))
        : Promise.resolve(),
      isAuthSettingsPatch
        ? c.env.APP_KV.put(clientAuthSettingsKey(platform), JSON.stringify(authSettings))
        : Promise.resolve(),
      isCorsSettingsPatch && corsSettings
        ? c.env.APP_KV.put(webCorsSettingsKey, JSON.stringify(corsSettings))
        : Promise.resolve(),
      canPatchDialogSettings
        ? c.env.APP_KV.put(clientDialogSettingsKey(platform), JSON.stringify(dialogSettings))
        : Promise.resolve(),
      isUsageLimitPatch
        ? c.env.APP_KV.put(clientUsageLimitKey(platform), JSON.stringify(usageLimit))
        : Promise.resolve(),
      canPatchTelegramSettings
        ? saveTelegramSettings(c.env.APP_KV, telegramSettingsResult.data)
        : Promise.resolve(),
    ]);

    const clientId = await getOrCreateClientId(c.env.APP_KV, platform);

    if (platform === "telegram") {
      const telegramSettings = await getTelegramSettings(c.env.APP_KV);

      return c.json(
        parseResponse(clientConfigResponseSchema, {
          platform,
          clientId,
          basicSettings,
          authSettings,
          usageLimit,
          telegramSettings: createTelegramSettingsResponse(telegramSettings),
        }),
      );
    }

    if (!dialogSettings) {
      return c.json(
        parseResponse(errorResponseSchema, { error: "Dialog settings unavailable" }),
        500,
      );
    }

    if (platform === "web") {
      if (!corsSettings) {
        return c.json(
          parseResponse(errorResponseSchema, { error: "CORS settings unavailable" }),
          500,
        );
      }

      return c.json(
        parseResponse(clientConfigResponseSchema, {
          platform,
          clientId,
          basicSettings,
          authSettings,
          dialogSettings,
          corsSettings,
          usageLimit,
        }),
      );
    }

    return c.json(
      parseResponse(clientConfigResponseSchema, {
        platform,
        clientId,
        basicSettings,
        authSettings,
        dialogSettings,
        usageLimit,
      }),
    );
  });
