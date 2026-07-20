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
  type ClientDialogSettings,
  type ClientPlatform,
} from "../../shared/client";
import { getSettings } from "./settings";
import { errorResponseSchema, parseResponse } from "./validation";

const clientConfigKey = (platform: ClientPlatform) =>
  `client:${platform}:client-id`;

const clientDialogSettingsKey = (platform: ClientPlatform) =>
  `client:${platform}:dialog-settings`;

const createClientId = (platform: ClientPlatform) =>
  `${platform}_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;

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
    const key = clientConfigKey(platform);
    const savedClientId = await c.env.APP_KV.get(key);
    const clientId = savedClientId ?? createClientId(platform);

    if (!savedClientId) {
      await c.env.APP_KV.put(key, clientId);
    }

    const dialogSettings = await getClientDialogSettings(c.env.APP_KV, platform);

    return c.json(
      parseResponse(clientConfigResponseSchema, {
        platform,
        clientId,
        dialogSettings,
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

    const bodyResult = clientDialogSettingsPatchSchema.safeParse(
      await c.req.json().catch(() => null),
    );

    if (!bodyResult.success) {
      return c.json(
        {
          error: "Invalid body",
          issues: z.treeifyError(bodyResult.error),
        },
        400,
      );
    }

    const platform = platformResult.data;
    const dialogSettings = {
      ...(await getClientDialogSettings(c.env.APP_KV, platform)),
      ...bodyResult.data,
    };

    await c.env.APP_KV.put(
      clientDialogSettingsKey(platform),
      JSON.stringify(dialogSettings),
    );

    const key = clientConfigKey(platform);
    const savedClientId = await c.env.APP_KV.get(key);
    const clientId = savedClientId ?? createClientId(platform);

    if (!savedClientId) {
      await c.env.APP_KV.put(key, clientId);
    }

    return c.json(
      parseResponse(clientConfigResponseSchema, {
        platform,
        clientId,
        dialogSettings,
      }),
    );
  });
