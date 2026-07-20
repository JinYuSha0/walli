import { z } from "zod";

export const CLIENT_PLATFORMS = ["web", "react-native", "flutter"] as const;

export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

export const clientPlatformSchema = z.enum(CLIENT_PLATFORMS);

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

export const clientConfigResponseSchema = z
  .object({
    platform: clientPlatformSchema,
    clientId: z.string(),
    dialogSettings: clientDialogSettingsSchema,
  })
  .strict();

export type ClientDialogSettings = z.output<typeof clientDialogSettingsSchema>;

export type ClientDialogSettingsPatch = z.output<
  typeof clientDialogSettingsPatchSchema
>;

export type ClientConfigResponse = z.output<typeof clientConfigResponseSchema>;
