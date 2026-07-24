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
    historyMessageLimit: z.number().int().min(0),
    autoDeletePeriod: z.enum(["day", "week", "month"]),
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
    accessPolicy: z.enum(["public", "whitelist"]),
  })
  .strict();

export const telegramWhitelistTypeSchema = z.enum(["private", "group"]);

export const TELEGRAM_WHITELIST_ID_MAX_LENGTH = 64;
export const TELEGRAM_WHITELIST_REMARK_MAX_LENGTH = 100;
export const TELEGRAM_WHITELIST_ID_PATTERN = /^-?\d+$/;

export const telegramWhitelistIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(TELEGRAM_WHITELIST_ID_MAX_LENGTH)
  .regex(TELEGRAM_WHITELIST_ID_PATTERN);

export const telegramWhitelistRemarkSchema = z
  .string()
  .trim()
  .max(TELEGRAM_WHITELIST_REMARK_MAX_LENGTH);

export const telegramWhitelistEntrySchema = z
  .object({
    type: telegramWhitelistTypeSchema,
    id: telegramWhitelistIdSchema,
    remark: telegramWhitelistRemarkSchema,
    createdAt: z.number(),
  })
  .strict();

export const telegramWhitelistListResponseSchema = z
  .object({
    items: z.array(telegramWhitelistEntrySchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  })
  .strict();

export const telegramWhitelistCreateSchema = z
  .object({
    type: telegramWhitelistTypeSchema,
    id: telegramWhitelistIdSchema,
    remark: telegramWhitelistRemarkSchema.optional(),
  })
  .strict();

const telegramSettingsPatchAliases = {
  botToken: ["botToken", "bot_token"],
  accessPolicy: ["accessPolicy", "access_policy"],
} as const;

const normalizeTelegramSettingsPatch = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const settings: Record<string, unknown> = {};

  for (const [settingKey, aliases] of Object.entries(telegramSettingsPatchAliases)) {
    const alias = aliases.find((key) => key in record);

    if (alias) {
      settings[settingKey] = record[alias];
    }
  }

  return settings;
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
    accessPolicy: telegramSettingsSchema.shape.accessPolicy,
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

export type TelegramSettings = z.output<typeof telegramSettingsSchema>;

export type TelegramWhitelistType = z.output<typeof telegramWhitelistTypeSchema>;

export type TelegramWhitelistEntry = z.output<typeof telegramWhitelistEntrySchema>;

export type TelegramWhitelistListResponse = z.output<
  typeof telegramWhitelistListResponseSchema
>;

export type TelegramWhitelistCreate = z.output<typeof telegramWhitelistCreateSchema>;

export type ClientConfigResponse = z.output<typeof clientConfigResponseSchema>;
