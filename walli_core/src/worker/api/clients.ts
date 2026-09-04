import { Hono } from "hono";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import type { Database } from "@worker/db/client";
import { createDb } from "@worker/db/client";
import { client as clientTable, telegramWhitelistUser } from "@worker/db/schema";
import type { AppBindings } from "./types";
import { requireAdmin } from "./helper/middleware";
import {
  clientCreateSchema,
  clientAuthSettingsPatchSchema,
  clientAuthSettingsSchema,
  clientBasicSettingsPatchSchema,
  clientBasicSettingsSchema,
  clientCorsSettingsPatchSchema,
  clientCorsSettingsSchema,
  clientDialogSettingsPatchSchema,
  clientDialogSettingsSchema,
  clientConfigResponseSchema,
  clientUsageLimitPatchSchema,
  clientUsageLimitSchema,
  telegramSettingsPatchSchema,
  telegramSettingsSchema,
  type ClientAuthSettings,
  type ClientBasicSettings,
  type ClientCorsSettings,
  type ClientDialogSettings,
  type Client,
  type ClientUsageLimit,
  type TelegramSettings,
  type TelegramSettingsPatch,
} from "@shared/client";
import { getSettings } from "./settings";
import { errorResponseSchema, parseResponse } from "./helper/validation";
import { getAsyncContext } from "@worker/lib/async-context";

const clientSettingsPrefix = (clientId: string) => `client:${clientId}`;

const clientBasicSettingsKey = (clientId: string) => `${clientSettingsPrefix(clientId)}:basic-settings`;

const clientDialogSettingsKey = (clientId: string) => `${clientSettingsPrefix(clientId)}:dialog-settings`;

const clientUsageLimitKey = (clientId: string) => `${clientSettingsPrefix(clientId)}:usage-limit`;

const clientAuthSettingsKey = (clientId: string) => `${clientSettingsPrefix(clientId)}:auth-settings`;

const webCorsSettingsKey = (clientId: string) => `${clientSettingsPrefix(clientId)}:cors-settings`;

const telegramSettingsKey = (clientId: string) => `${clientSettingsPrefix(clientId)}:telegram-settings`;

export const getClients = async (): Promise<Client[]> => {
  return createDb()
    .select({
      id: clientTable.id,
      name: clientTable.name,
      slug: clientTable.slug,
      platform: clientTable.platform,
    })
    .from(clientTable)
    .orderBy(asc(clientTable.createdAt), asc(clientTable.id))
    .all();
};

export const getClientById = async (id: string) =>
  createDb()
    .select({
      id: clientTable.id,
      name: clientTable.name,
      slug: clientTable.slug,
      platform: clientTable.platform,
    })
    .from(clientTable)
    .where(eq(clientTable.id, id))
    .get();

export const getClientBySlug = async (slug: string) =>
  createDb()
    .select({
      id: clientTable.id,
      name: clientTable.name,
      slug: clientTable.slug,
      platform: clientTable.platform,
    })
    .from(clientTable)
    .where(eq(clientTable.slug, slug))
    .get();

const defaultBasicSettings = {
  enabled: false,
  additionalSystemPrompt: "",
} satisfies ClientBasicSettings;

export const getClientBasicSettings = async (clientId: string) => {
  const appKv = getAsyncContext().env.APP_KV;
  const savedSettings = await appKv.get(clientBasicSettingsKey(clientId), "json");
  const result = clientBasicSettingsSchema.partial().safeParse(savedSettings);

  if (!result.success) {
    return defaultBasicSettings;
  }

  return {
    ...defaultBasicSettings,
    ...result.data,
  };
};

const getDefaultDialogSettings = async (): Promise<ClientDialogSettings> => {
  const settings = await getSettings();

  return {
    dialogSystemPrompt: settings.dialogSystemPrompt,
    dialogOpeningMessage: "",
    dialogInputMaxLength: 300,
    dialogPlaceholder: "",
    dialogSpeechEnabled: false,
    dialogImageEnabled: false,
  };
};

const getClientDialogSettings = async (clientId: string) => {
  const appKv = getAsyncContext().env.APP_KV;
  const defaultDialogSettings = await getDefaultDialogSettings();
  const savedSettings = await appKv.get(clientDialogSettingsKey(clientId), "json");
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
  historyMessageLimit: 20,
  autoDeletePeriod: "week",
} satisfies ClientUsageLimit;

export const getClientUsageLimit = async (clientId: string) => {
  const appKv = getAsyncContext().env.APP_KV;
  const savedUsageLimit = await appKv.get(clientUsageLimitKey(clientId), "json");
  const result = clientUsageLimitSchema.partial().safeParse(savedUsageLimit);

  if (!result.success) {
    return defaultUsageLimit;
  }

  return {
    ...defaultUsageLimit,
    ...result.data,
  };
};

const getDefaultAuthSettings = async (): Promise<ClientAuthSettings> => {
  const settings = await getSettings();

  return {
    authEnabled: settings.authEnabled,
    authEndpointUrl: settings.authEndpointUrl,
  };
};

export const getClientAuthSettings = async (clientId: string) => {
  const appKv = getAsyncContext().env.APP_KV;
  const defaultAuthSettings = await getDefaultAuthSettings();
  const savedSettings = await appKv.get(clientAuthSettingsKey(clientId), "json");
  const result = clientAuthSettingsSchema.partial().safeParse(savedSettings);

  if (!result.success) {
    return defaultAuthSettings;
  }

  return {
    ...defaultAuthSettings,
    ...result.data,
  };
};

const getDefaultCorsSettings = async (): Promise<ClientCorsSettings> => {
  const settings = await getSettings();

  return {
    corsAllowedOrigins: settings.corsAllowedOrigins,
  };
};

export const getWebCorsSettings = async (clientId: string): Promise<ClientCorsSettings> => {
  const appKv = getAsyncContext().env.APP_KV;
  const defaultCorsSettings = await getDefaultCorsSettings();
  const savedSettings = await appKv.get(webCorsSettingsKey(clientId), "json");
  const result = clientCorsSettingsSchema.partial().safeParse(savedSettings);

  if (!result.success) {
    return defaultCorsSettings;
  }

  return {
    ...defaultCorsSettings,
    ...result.data,
  };
};

export const getClientFromClientId = async (clientId: string | undefined) =>
  clientId ? getClientById(clientId.trim()) : undefined;

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

export const getTelegramSettings = async (clientId: string) => {
  const appKv = getAsyncContext().env.APP_KV;
  const savedSettings = await appKv.get(telegramSettingsKey(clientId), "json");
  const result = telegramSettingsSchema.partial().safeParse(savedSettings);

  if (!result.success) {
    return defaultTelegramSettings;
  }

  return {
    ...defaultTelegramSettings,
    ...result.data,
  };
};

export const getTelegramBotToken = async (clientId?: string) => {
  const env = getAsyncContext().env;
  const resolvedClientId = clientId ?? (await getClients()).find(({ platform }) => platform === "telegram")?.id;
  const settings = resolvedClientId ? await getTelegramSettings(resolvedClientId) : defaultTelegramSettings;

  return settings.botToken.trim() || env.TELEGRAM_BOT_TOKEN?.trim() || "";
};

const saveTelegramSettings = async (clientId: string, patch: TelegramSettingsPatch) => {
  const appKv = getAsyncContext().env.APP_KV;
  const currentSettings = await getTelegramSettings(clientId);
  const settingsPatch = {
    ...(patch.botToken === undefined ? {} : { botToken: patch.botToken }),
    ...(patch.accessPolicy === undefined ? {} : { accessPolicy: patch.accessPolicy }),
  } satisfies Partial<TelegramSettings>;
  const settings = {
    ...currentSettings,
    ...settingsPatch,
  };

  await appKv.put(telegramSettingsKey(clientId), JSON.stringify(settings));

  return settings;
};

const deleteTelegramWhitelistEntries = async (db: Database) => {
  await db.delete(telegramWhitelistUser).run();
};

const createTelegramSettingsResponse = (settings: TelegramSettings) => ({
  botTokenMask: maskSecret(settings.botToken),
  accessPolicy: settings.accessPolicy,
});

const getClientConfigResponse = async (client: Client) => {
  const { platform } = client;
  const basicSettings = await getClientBasicSettings(client.id);
  const authSettings = await getClientAuthSettings(client.id);
  const usageLimit = await getClientUsageLimit(client.id);

  if (platform === "telegram") {
    const telegramSettings = await getTelegramSettings(client.id);

    return parseResponse(clientConfigResponseSchema, {
      id: client.id,
      name: client.name,
      slug: client.slug,
      platform: "telegram",
      basicSettings,
      authSettings,
      usageLimit,
      telegramSettings: createTelegramSettingsResponse(telegramSettings),
    });
  }

  const dialogSettings = await getClientDialogSettings(client.id);

  if (platform === "web") {
    const corsSettings = await getWebCorsSettings(client.id);

    return parseResponse(clientConfigResponseSchema, {
      id: client.id,
      name: client.name,
      slug: client.slug,
      platform: "web",
      basicSettings,
      authSettings,
      dialogSettings,
      corsSettings,
      usageLimit,
    });
  }

  return parseResponse(clientConfigResponseSchema, {
    id: client.id,
    name: client.name,
    slug: client.slug,
    platform,
    basicSettings,
    authSettings,
    dialogSettings,
    usageLimit,
  });
};

const resetClientSettings = async (client: Client) => {
  const appKv = getAsyncContext().env.APP_KV;
  const { id, platform } = client;
  const keys = [
    clientBasicSettingsKey(id),
    clientAuthSettingsKey(id),
    clientUsageLimitKey(id),
  ];

  if (platform === "telegram") {
    keys.push(telegramSettingsKey(id));
  } else {
    keys.push(clientDialogSettingsKey(id));
  }

  if (platform === "web") {
    keys.push(webCorsSettingsKey(id));
  }

  await Promise.all(keys.map((key) => appKv.delete(key)));
};

export const clientsRoute = new Hono<AppBindings>()
  .use("/api/admin/clients/*", requireAdmin)
  .get("/api/admin/clients", async (c) => c.json(await getClients()))
  .post("/api/admin/clients", async (c) => {
    const result = clientCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!result.success) return c.json({ error: "Invalid body", issues: z.treeifyError(result.error) }, 400);
    if (await getClientBySlug(result.data.slug)) {
      return c.json({ error: "Slug already exists" }, 409);
    }
    const client = { id: crypto.randomUUID(), ...result.data } satisfies Client;
    const now = Date.now();
    await createDb().insert(clientTable).values({
      ...client,
      createdAt: now,
      updatedAt: now,
    }).run();
    return c.json(await getClientConfigResponse(client), 201);
  })
  .get("/api/admin/clients/:clientId", async (c) => {
    const client = await getClientById(c.req.param("clientId"));
    if (!client) return c.json({ error: "Client not found" }, 404);
    return c.json(await getClientConfigResponse(client));
  })
  .delete("/api/admin/clients/:clientId", async (c) => {
    const client = await getClientById(c.req.param("clientId"));
    if (!client) return c.json({ error: "Client not found" }, 404);

    await createDb().delete(clientTable).where(eq(clientTable.id, client.id)).run();
    await resetClientSettings(client);

    return c.body(null, 204);
  })
  .post("/api/admin/clients/:clientId/reset-settings", async (c) => {
    const client = await getClientById(c.req.param("clientId"));
    if (!client) return c.json({ error: "Client not found" }, 404);
    await resetClientSettings(client);
    if (client.platform === "telegram") {
      await deleteTelegramWhitelistEntries(c.get("db"));
    }
    return c.json(await getClientConfigResponse(client));
  })
  .patch("/api/admin/clients/:clientId", async (c) => {
    const client = await getClientById(c.req.param("clientId"));
    if (!client) return c.json({ error: "Client not found" }, 404);
    const platform = client.platform;
    const clientId = client.id;
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

    const currentUsageLimit = await getClientUsageLimit(clientId);
    const currentBasicSettings = await getClientBasicSettings(clientId);
    const currentAuthSettings = await getClientAuthSettings(clientId);
    const currentCorsSettings =
      platform === "web" ? await getWebCorsSettings(clientId) : undefined;
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
      const currentDialogSettings = await getClientDialogSettings(clientId);
      dialogSettings = isDialogSettingsPatch
        ? {
            ...currentDialogSettings,
            ...dialogSettingsResult.data,
          }
        : currentDialogSettings;
    }

    await Promise.all([
      isBasicSettingsPatch
        ? getAsyncContext().env.APP_KV.put(clientBasicSettingsKey(clientId), JSON.stringify(basicSettings))
        : Promise.resolve(),
      isAuthSettingsPatch
        ? getAsyncContext().env.APP_KV.put(clientAuthSettingsKey(clientId), JSON.stringify(authSettings))
        : Promise.resolve(),
      isCorsSettingsPatch && corsSettings
        ? getAsyncContext().env.APP_KV.put(webCorsSettingsKey(clientId), JSON.stringify(corsSettings))
        : Promise.resolve(),
      canPatchDialogSettings
        ? getAsyncContext().env.APP_KV.put(clientDialogSettingsKey(clientId), JSON.stringify(dialogSettings))
        : Promise.resolve(),
      isUsageLimitPatch
        ? getAsyncContext().env.APP_KV.put(clientUsageLimitKey(clientId), JSON.stringify(usageLimit))
        : Promise.resolve(),
      canPatchTelegramSettings
        ? saveTelegramSettings(clientId, telegramSettingsResult.data)
        : Promise.resolve(),
    ]);

    if (platform === "telegram") {
      const telegramSettings = await getTelegramSettings(clientId);

      return c.json(
        parseResponse(clientConfigResponseSchema, {
          id: client.id,
          name: client.name,
          slug: client.slug,
          platform: "telegram",
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
          id: client.id,
          name: client.name,
          slug: client.slug,
          platform: "web",
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
        id: client.id,
        name: client.name,
        slug: client.slug,
        platform,
        basicSettings,
        authSettings,
        dialogSettings,
        usageLimit,
      }),
    );
  });
