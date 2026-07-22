import { z } from "zod";

export const CLIENT_PLATFORMS = ["telegram", "web", "react-native", "flutter"] as const;

export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

export const clientPlatformSchema = z.enum(CLIENT_PLATFORMS);

export const clientBasicSettingsSchema = z
  .object({
    enabled: z.boolean(),
    additionalSystemPrompt: z.string(),
  })
  .strict();

export const clientBasicSettingsPatchSchema = clientBasicSettingsSchema
  .partial()
  .refine(
    (settings) => Object.keys(settings).length > 0,
    "At least one client basic setting is required",
  );

export const clientDialogSettingsSchema = z
  .object({
    dialogSystemPrompt: z.string(),
    dialogOpeningMessage: z.string(),
    dialogInputMaxLength: z.number().int().min(1),
    dialogPlaceholder: z.string(),
    dialogSpeechEnabled: z.boolean(),
    dialogImageEnabled: z.boolean(),
  })
  .strict();

export const clientDialogSettingsPatchSchema = clientDialogSettingsSchema
  .partial()
  .refine(
    (settings) => Object.keys(settings).length > 0,
    "At least one client dialog setting is required",
  );

export const clientUsageLimitSchema = z
  .object({
    perRequestInputLimit: z.number().int().min(0),
    perRequestOutputLimit: z.number().int().min(0),
    perUserDailyInputLimit: z.number().int().min(0),
    perUserDailyOutputLimit: z.number().int().min(0),
  })
  .strict();

export const clientUsageLimitPatchSchema = clientUsageLimitSchema
  .partial()
  .refine(
    (settings) => Object.keys(settings).length > 0,
    "At least one client usage limit setting is required",
  );

export const clientAuthSettingsSchema = z
  .object({
    authEnabled: z.boolean(),
    authEndpointUrl: z.string(),
  })
  .strict();

export const clientAuthSettingsPatchSchema = clientAuthSettingsSchema
  .partial()
  .refine(
    (settings) => Object.keys(settings).length > 0,
    "At least one client auth setting is required",
  );

export const clientCorsSettingsSchema = z
  .object({
    corsAllowedOrigins: z.array(z.string()),
  })
  .strict();

export const clientCorsSettingsPatchSchema = clientCorsSettingsSchema
  .partial()
  .refine(
    (settings) => Object.keys(settings).length > 0,
    "At least one client CORS setting is required",
  );

export const telegramSettingsSchema = z
  .object({
    botToken: z.string(),
  })
  .strict();

const normalizeTelegramSettingsPatch = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  if ("botToken" in record) {
    return {
      botToken: record.botToken,
    };
  }

  if ("bot_token" in record) {
    return {
      botToken: record.bot_token,
    };
  }

  return {};
};

export const telegramSettingsPatchSchema = z.preprocess(
  normalizeTelegramSettingsPatch,
  telegramSettingsSchema.partial().strict(),
)
  .refine(
    (settings) => Object.keys(settings).length > 0,
    "At least one Telegram setting is required",
  );

export const telegramSettingsResponseSchema = z
  .object({
    botTokenMask: z.string(),
  })
  .strict();

const baseClientConfigResponseSchema = z
  .object({
    platform: clientPlatformSchema,
    clientId: z.string(),
    basicSettings: clientBasicSettingsSchema,
    authSettings: clientAuthSettingsSchema,
    usageLimit: clientUsageLimitSchema,
  })
  .strict();

export const telegramClientConfigResponseSchema = baseClientConfigResponseSchema.extend({
  platform: z.literal("telegram"),
  telegramSettings: telegramSettingsResponseSchema,
});

export const dialogClientConfigResponseSchema = baseClientConfigResponseSchema.extend({
  platform: z.enum(["react-native", "flutter"]),
  dialogSettings: clientDialogSettingsSchema,
});

export const webClientConfigResponseSchema = baseClientConfigResponseSchema.extend({
  platform: z.literal("web"),
  dialogSettings: clientDialogSettingsSchema,
  corsSettings: clientCorsSettingsSchema,
});

export const clientConfigResponseSchema = z.union([
  telegramClientConfigResponseSchema,
  webClientConfigResponseSchema,
  dialogClientConfigResponseSchema,
]);

export type ClientBasicSettings = z.output<typeof clientBasicSettingsSchema>;

export type ClientBasicSettingsPatch = z.output<
  typeof clientBasicSettingsPatchSchema
>;

export type ClientDialogSettings = z.output<typeof clientDialogSettingsSchema>;

export type ClientDialogSettingsPatch = z.output<
  typeof clientDialogSettingsPatchSchema
>;

export type ClientUsageLimit = z.output<typeof clientUsageLimitSchema>;

export type ClientUsageLimitPatch = z.output<typeof clientUsageLimitPatchSchema>;

export type ClientAuthSettings = z.output<typeof clientAuthSettingsSchema>;

export type ClientAuthSettingsPatch = z.output<
  typeof clientAuthSettingsPatchSchema
>;

export type ClientCorsSettings = z.output<typeof clientCorsSettingsSchema>;

export type ClientCorsSettingsPatch = z.output<
  typeof clientCorsSettingsPatchSchema
>;

export type TelegramSettingsPatch = z.output<typeof telegramSettingsPatchSchema>;

export type ClientConfigResponse = z.output<typeof clientConfigResponseSchema>;
