import { z } from "zod";

export const SETTINGS_KV_KEY = "settings";

export const SETTINGS_KEY_MAP = {
  models: "settings:models",
  primaryModel: "settings:primary-model",
  embeddingModel: "settings:embedding-model",
  tools: "settings:tools",
  primaryModelUsageLimit: "settings:primary-model-usage-limit",
  globalPrompt: "settings:global-prompt",
  dialogSystemPrompt: "settings:dialog-system-prompt",
  dialogOpeningMessage: "settings:dialog-opening-message",
  dialogSpeechEnabled: "settings:dialog-speech-enabled",
  dialogImageEnabled: "settings:dialog-image-enabled",
  authEnabled: "settings:auth-enabled",
  authEndpointUrl: "settings:auth-endpoint-url",
  corsAllowedOrigins: "settings:cors-allowed-origins",
} as const;

export type SettingsKey = keyof typeof SETTINGS_KEY_MAP;

export const MODEL_CAPABILITY_TAGS = [
  "text-generation",
  "tool-calling",
  "image-recognition",
  "speech-to-text",
  "text-to-speech",
  "embedding",
] as const;

export type ModelCapabilityTag = (typeof MODEL_CAPABILITY_TAGS)[number];

export const modelConfigSchema = z
  .object({
    name: z.string().trim().min(1),
    tags: z.array(z.enum(MODEL_CAPABILITY_TAGS)),
  })
  .strict();

export type ModelConfig = z.output<typeof modelConfigSchema>;

export const primaryModelUsageLimitConfigSchema = z
  .object({
    perRequestInputLimit: z.number().int().min(0),
    perRequestOutputLimit: z.number().int().min(0),
    perUserDailyInputLimit: z.number().int().min(0),
    perUserDailyOutputLimit: z.number().int().min(0),
  })
  .strict();

export type PrimaryModelUsageLimitConfig = z.output<
  typeof primaryModelUsageLimitConfigSchema
>;

export const TOOL_SCHEMA_FIELD_TYPES = ["string", "number", "boolean", "array", "object"] as const;

export type ToolSchemaFieldType = (typeof TOOL_SCHEMA_FIELD_TYPES)[number];

export const toolSchemaFieldSchema = z
  .object({
    name: z.string().trim().min(1),
    type: z.enum(TOOL_SCHEMA_FIELD_TYPES),
    description: z.string().trim().min(1),
    required: z.boolean(),
    defaultValue: z.string().optional(),
  })
  .strict()
  .transform((field) => ({
    ...field,
    defaultValue: field.defaultValue ?? "",
  }));

export type ToolSchemaField = z.output<typeof toolSchemaFieldSchema>;

export const TOOL_INVOCATION_TYPES = ["model", "api"] as const;

export type ToolInvocationType = (typeof TOOL_INVOCATION_TYPES)[number];

export const TOOL_API_METHODS = ["GET", "POST"] as const;

export type ToolApiMethod = (typeof TOOL_API_METHODS)[number];

export const TOOL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/;

export const toolApiHeaderSchema = z
  .object({
    name: z.string().trim().min(1),
    defaultValue: z.string().trim().min(1),
  })
  .strict();

export type ToolApiHeader = z.output<typeof toolApiHeaderSchema>;

export const toolModelInvocationSchema = z
  .object({
    type: z.literal("model"),
    model: z.string().trim().min(1),
  })
  .strict();

export type ToolModelInvocation = z.output<typeof toolModelInvocationSchema>;

export const toolApiInvocationSchema = z
  .object({
    type: z.literal("api"),
    url: z
      .url()
      .refine(
        (url) => url.startsWith("http://") || url.startsWith("https://"),
        "URL must start with http:// or https://",
      ),
    method: z.enum(TOOL_API_METHODS),
    headers: z.array(toolApiHeaderSchema).default([]),
  })
  .strict()
  .transform((invocation) => ({
    ...invocation,
    headers: invocation.headers ?? [],
  }));

export type ToolApiInvocation = z.output<typeof toolApiInvocationSchema>;

export const toolInvocationSchema = z.union([toolModelInvocationSchema, toolApiInvocationSchema]);

export type ToolInvocation = z.output<typeof toolInvocationSchema>;

const defaultToolInvocation = {
  type: "model",
  model: "",
} as const;

export const toolConfigSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().min(1),
    invocation: toolInvocationSchema.default(defaultToolInvocation),
    schema: z
      .object({
        fields: z.array(toolSchemaFieldSchema).min(1),
      })
      .strict()
      .refine(
        (schema) => schema.fields.some((field) => field.required),
        "At least one required schema field is required",
      ),
  })
  .strict()
  .transform((tool) => ({
    ...tool,
    invocation: tool.invocation ?? defaultToolInvocation,
  }));

export type ToolConfig = z.output<typeof toolConfigSchema>;

export const settingsFieldSchemaMap = {
  models: z.array(modelConfigSchema),
  primaryModel: z.string(),
  embeddingModel: z.string(),
  tools: z.array(toolConfigSchema),
  primaryModelUsageLimit: primaryModelUsageLimitConfigSchema,
  globalPrompt: z.string(),
  dialogSystemPrompt: z.string(),
  dialogOpeningMessage: z.string(),
  dialogSpeechEnabled: z.boolean(),
  dialogImageEnabled: z.boolean(),
  authEnabled: z.boolean(),
  authEndpointUrl: z.string(),
  corsAllowedOrigins: z.array(z.string()),
} satisfies Record<SettingsKey, z.ZodType>;

export const settingsSchema = z.object(settingsFieldSchemaMap).strict();

export const settingsResponseSchema = settingsSchema;

export const settingsPatchSchema = settingsSchema
  .partial()
  .refine((settings) => Object.keys(settings).length > 0, "At least one setting is required");

export type Settings = z.output<typeof settingsSchema>;

export type SettingsPatch = Partial<Settings>;

export type SettingsResponse = z.output<typeof settingsResponseSchema>;

export const DEFAULT_SETTINGS = {
  models: [
    {
      name: "openai/gpt-5.4-mini",
      tags: ["text-generation", "image-recognition", "tool-calling"],
    },
    {
      name: "openai/gpt-4o-transcribe",
      tags: ["speech-to-text"],
    },
    {
      name: "openai/tts-1",
      tags: ["text-to-speech"],
    },
    {
      name: "@cf/qwen/qwen3-embedding-0.6b",
      tags: ["embedding"],
    },
  ],
  primaryModel: "openai/gpt-5.4-mini",
  embeddingModel: "@cf/qwen/qwen3-embedding-0.6b",
  primaryModelUsageLimit: {
    perRequestInputLimit: 0,
    perRequestOutputLimit: 0,
    perUserDailyInputLimit: 0,
    perUserDailyOutputLimit: 0,
  },
  tools: [
    {
      name: "voice_to_text",
      description: "A speech-to-text model, output text",
      invocation: {
        type: "model",
        model: "openai/gpt-4o-transcribe",
      },
      schema: {
        fields: [
          {
            name: "file",
            type: "string",
            description:
              "The audio file as a data URI (data:audio/...;base64,...) or HTTPS URL. Supported formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm.",
            required: true,
            defaultValue: "",
          },
          {
            name: "language",
            type: "string",
            description:
              "language string The language of the input audio. Supplying the input language in ISO-639-1 format will improve accuracy and latency.",
            required: false,
            defaultValue: "",
          },
          {
            name: "prompt",
            type: "string",
            description:
              "An optional text to guide the model's style or continue a previous audio segment. The prompt should match the audio language.",
            required: false,
            defaultValue: "",
          },
          {
            name: "temperature",
            type: "number",
            description:
              "The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. Defaults to 0 if omitted.",
            required: false,
            defaultValue: "",
          },
        ],
      },
    },
    {
      name: "text_to_voice",
      description: "text-to-speech model, output audio url",
      invocation: {
        type: "model",
        model: "openai/tts-1",
      },
      schema: {
        fields: [
          {
            name: "text",
            type: "string",
            description: "The text to generate audio for. Maximum length is 4096 characters.",
            required: true,
            defaultValue: "",
          },
          {
            name: "voice",
            type: "string",
            description: "The voice to use when generating the audio. Defaults to alloy.",
            required: false,
            defaultValue: "alloy",
          },
          {
            name: "response_format",
            type: "string",
            description:
              "The output format for the audio. Supported formats are mp3, opus, wav, aac and flac.",
            required: false,
            defaultValue: "mp3",
          },
          {
            name: "speed",
            type: "number",
            description:
              "The speed of the generated audio. Select a value from 0.25 to 4.0. 1.0 is the default.",
            required: false,
            defaultValue: "1",
          },
        ],
      },
    },
    {
      name: "image_to_text",
      description: "image-to-text model, output text",
      invocation: {
        type: "model",
        model: "openai/gpt-5.4-mini",
      },
      schema: {
        fields: [
          {
            name: "file",
            type: "string",
            description: "The image HTTPS URL.",
            required: true,
            defaultValue: "",
          },
        ],
      },
    },
  ],
  globalPrompt: "",
  dialogSystemPrompt: "",
  dialogOpeningMessage: "",
  dialogSpeechEnabled: true,
  dialogImageEnabled: true,
  authEnabled: false,
  authEndpointUrl: "",
  corsAllowedOrigins: [],
} satisfies Settings;
