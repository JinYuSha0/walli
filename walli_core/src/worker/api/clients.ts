import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { hasAdminRole } from "./auth";
import type { AppBindings } from "./types";
import {
  clientDialogSettingsPatchSchema,
  clientDialogSettingsSchema,
  clientConfigResponseSchema,
  clientPlatformSchema,
  clientUsageLimitPatchSchema,
  clientUsageLimitSchema,
  telegramSettingsPatchSchema,
  telegramSettingsSchema,
  type ClientDialogSettings,
  type ClientPlatform,
  type ClientUsageLimit,
  type TelegramSettingsPatch,
} from "../../shared/client";
import { getSettings } from "./settings";
import { errorResponseSchema, parseResponse } from "./validation";

const clientConfigKey = (platform: ClientPlatform) =>
  `client:${platform}:client-id`;

const clientDialogSettingsKey = (platform: ClientPlatform) =>
  `client:${platform}:dialog-settings`;

const clientUsageLimitKey = (platform: ClientPlatform) =>
  `client:${platform}:usage-limit`;

const telegramSettingsKey = "client:telegram:settings";

const createClientId = (platform: ClientPlatform) =>
  `${platform}_${crypto.randomUUID().replaceAll("-", "")}`;

export const getOrCreateClientId = async (
  appKv: KVNamespace,
  platform: ClientPlatform,
) => {
  const key = clientConfigKey(platform);
  const savedClientId = await appKv.get(key);
  const clientId = savedClientId ?? createClientId(platform);

  if (!savedClientId) {
    await appKv.put(key, clientId);
  }

  return clientId;
};

const getDefaultDialogSettings = async (
  appKv: KVNamespace,
): Promise<ClientDialogSettings> => {
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

const getClientDialogSettings = async (
  appKv: KVNamespace,
  platform: ClientPlatform,
) => {
  const defaultDialogSettings = await getDefaultDialogSettings(appKv);
  const savedSettings = await appKv.get(
    clientDialogSettingsKey(platform),
    "json",
  );
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

const getTelegramSettings = async (appKv: KVNamespace) => {
  const savedSettings = await appKv.get(telegramSettingsKey, "json");
  const result = telegramSettingsSchema.partial().safeParse(savedSettings);

  return {
    botToken: result.success ? result.data.botToken ?? "" : "",
  };
};

export const getTelegramBotToken = async (appKv: KVNamespace, env: Env) => {
  const settings = await getTelegramSettings(appKv);

  return settings.botToken.trim() || env.TELEGRAM_BOT_TOKEN?.trim() || "";
};

const saveTelegramSettings = async (
  appKv: KVNamespace,
  patch: TelegramSettingsPatch,
) => {
  const currentSettings = await getTelegramSettings(appKv);
  const settings = {
    ...currentSettings,
    ...patch,
  };

  await appKv.put(telegramSettingsKey, JSON.stringify(settings));

  return settings;
};

const createTelegramSettingsResponse = (settings: { botToken: string }) => ({
  botTokenMask: maskSecret(settings.botToken),
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

    const platform = platformResult.data;
    const clientId = await getOrCreateClientId(c.env.APP_KV, platform);

    const usageLimit = await getClientUsageLimit(c.env.APP_KV, platform);

    if (platform === "telegram") {
      const telegramSettings = await getTelegramSettings(c.env.APP_KV);

      return c.json(
        parseResponse(clientConfigResponseSchema, {
          platform,
          clientId,
          usageLimit,
          telegramSettings: createTelegramSettingsResponse(telegramSettings),
        }),
      );
    }

    const dialogSettings = await getClientDialogSettings(c.env.APP_KV, platform);

    return c.json(
      parseResponse(clientConfigResponseSchema, {
        platform,
        clientId,
        dialogSettings,
        usageLimit,
      }),
    );
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
    const dialogSettingsResult = clientDialogSettingsPatchSchema.safeParse(body);
    const usageLimitResult = clientUsageLimitPatchSchema.safeParse(body);
    const telegramSettingsResult = telegramSettingsPatchSchema.safeParse(body);
    const isDialogSettingsPatch = dialogSettingsResult.success;
    const isUsageLimitPatch = usageLimitResult.success;
    const isTelegramSettingsPatch = platform === "telegram" && telegramSettingsResult.success;

    if (!isDialogSettingsPatch && !isUsageLimitPatch && !isTelegramSettingsPatch) {
      return c.json(
        {
          error: "Invalid body",
          issues: {
            dialogSettings: dialogSettingsResult.success
              ? undefined
              : z.treeifyError(dialogSettingsResult.error),
            usageLimit: usageLimitResult.success ? undefined : z.treeifyError(usageLimitResult.error),
            telegramSettings: telegramSettingsResult.success
              ? undefined
              : z.treeifyError(telegramSettingsResult.error),
          },
        },
        400,
      );
    }

    const currentUsageLimit = await getClientUsageLimit(c.env.APP_KV, platform);
    const canPatchDialogSettings = platform !== "telegram" && isDialogSettingsPatch;
    const canPatchTelegramSettings = platform === "telegram" && isTelegramSettingsPatch;
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

    const dialogClientConfig = {
      platform,
      clientId,
      dialogSettings,
      usageLimit,
    };

    return c.json(parseResponse(clientConfigResponseSchema, dialogClientConfig));
  });
