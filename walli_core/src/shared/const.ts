import { z } from "zod";
import { BUILT_IN_TOOLS } from "./tools";
export { BUILT_IN_TOOLS } from "./tools";

export const SETTINGS_KV_KEY = "settings";

export const SETTINGS_KEY_MAP = {
  models: "settings:models",
  primaryModel: "settings:primary-model",
  toolPlannerModel: "settings:tool-planner-model",
  embeddingModel: "settings:embedding-model",
  builtInTools: "settings:built-in-tools",
  tools: "settings:tools",
  primaryModelUsageLimit: "settings:primary-model-usage-limit",
  timeZone: "settings:time-zone",
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

export const UTC_OFFSET_TIME_ZONES = Array.from(
  { length: 27 },
  (_, index) => `UTC${index - 12 >= 0 ? "+" : ""}${index - 12}`,
) as [string, ...string[]];

const utcOffsetTimeZoneSchema = z.enum(UTC_OFFSET_TIME_ZONES);

const getUtcOffsetTimeZoneFromIana = (timeZone: string) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const shortOffset = parts.find((part) => part.type === "timeZoneName")?.value;

    if (!shortOffset) {
      return undefined;
    }

    const match = /^GMT(?:(?<sign>[+-])(?<hours>\d{1,2}))?$/.exec(shortOffset);

    if (!match) {
      return undefined;
    }

    const sign = match.groups?.sign ?? "+";
    const hours = Number(match.groups?.hours ?? 0);
    const offset = sign === "-" ? -hours : hours;
    const normalized = `UTC${offset >= 0 ? "+" : ""}${offset}`;

    return UTC_OFFSET_TIME_ZONES.includes(normalized) ? normalized : undefined;
  } catch {
    return undefined;
  }
};

const normalizeTimeZone = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const timeZone = value.trim();

  if (timeZone === "UTC") {
    return "UTC+0";
  }

  if (UTC_OFFSET_TIME_ZONES.includes(timeZone)) {
    return timeZone;
  }

  return getUtcOffsetTimeZoneFromIana(timeZone) ?? timeZone;
};

export const timeZoneConfigSchema = z.preprocess(
  normalizeTimeZone,
  utcOffsetTimeZoneSchema.default("UTC+0"),
);

const normalizePrimaryModelUsageLimitConfig = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  return {
    dailyInputLimit: record.dailyInputLimit ?? record.perUserDailyInputLimit ?? 0,
    dailyOutputLimit: record.dailyOutputLimit ?? record.perUserDailyOutputLimit ?? 0,
  };
};

export const primaryModelUsageLimitConfigBaseSchema = z
  .object({
    dailyInputLimit: z.number().int().min(0),
    dailyOutputLimit: z.number().int().min(0),
  })
  .strict();

export const primaryModelUsageLimitConfigSchema = z.preprocess(
  normalizePrimaryModelUsageLimitConfig,
  primaryModelUsageLimitConfigBaseSchema,
);

export type PrimaryModelUsageLimitConfig = z.output<
  typeof primaryModelUsageLimitConfigSchema
>;

export const TOOL_SCHEMA_FIELD_TYPES = [
  "string",
  "number",
  "boolean",
  "array",
  "object",
] as const;

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

const toolSchemaSchema = z
  .object({
    fields: z.array(toolSchemaFieldSchema),
  })
  .strict();

const toolConfigBaseSchema = z.object({
  enabled: z.boolean().default(true),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  invocation: toolInvocationSchema.default(defaultToolInvocation),
  schema: toolSchemaSchema,
}).strict();

const normalizeToolConfig = <Tool extends z.output<typeof toolConfigBaseSchema>>(tool: Tool) => ({
  ...tool,
  enabled: tool.enabled ?? true,
  invocation: tool.invocation ?? defaultToolInvocation,
});

export const toolConfigSchema = toolConfigBaseSchema
  .superRefine((tool, ctx) => {
    if (tool.invocation.type === "api") {
      return;
    }

    if (tool.schema.fields.some((field) => field.required)) {
      return;
    }

    ctx.addIssue({
      code: "custom",
      path: ["schema"],
      message: "At least one required schema field is required",
    });
  })
  .transform(normalizeToolConfig);

export type ToolConfig = z.output<typeof toolConfigSchema>;

const builtInToolApiInvocationSchema = z
  .object({
    type: z.literal("api"),
    url: z.string().trim().min(1),
    method: z.enum(TOOL_API_METHODS),
    headers: z.array(toolApiHeaderSchema).default([]),
  })
  .strict()
  .transform((invocation) => ({
    ...invocation,
    headers: invocation.headers ?? [],
  }));

const legacyBuiltInToolSettingSchema = z
  .object({
    name: z.string().trim().min(1),
    enabled: z.boolean().default(true),
  })
  .strict()
  .transform((tool) => ({
    ...tool,
    enabled: tool.enabled ?? true,
  }));

const builtInToolConfigSchema = toolConfigBaseSchema
  .extend({
    invocation: z.union([toolModelInvocationSchema, builtInToolApiInvocationSchema]),
  })
  .transform(normalizeToolConfig);

export const builtInToolSettingSchema = z.union([
  builtInToolConfigSchema,
  legacyBuiltInToolSettingSchema,
]).refine(
  (tool) => BUILT_IN_TOOLS.some((builtInTool) => builtInTool.name === tool.name),
  "Unknown built-in tool",
).transform((tool) => {
  const defaultTool = BUILT_IN_TOOLS.find((builtInTool) => builtInTool.name === tool.name)!;

  if ("description" in tool) {
    return {
      ...tool,
      name: defaultTool.name,
    };
  }

  return {
    ...defaultTool,
    enabled: tool.enabled,
  };
});

export type BuiltInToolSetting = z.output<typeof builtInToolSettingSchema>;

export const settingsFieldSchemaMap = {
  models: z.array(modelConfigSchema),
  primaryModel: z.string(),
  toolPlannerModel: z.string(),
  embeddingModel: z.string(),
  builtInTools: z.array(builtInToolSettingSchema),
  tools: z.array(toolConfigSchema),
  primaryModelUsageLimit: primaryModelUsageLimitConfigSchema,
  timeZone: timeZoneConfigSchema,
  globalPrompt: z.string(),
  dialogSystemPrompt: z.string(),
  dialogOpeningMessage: z.string(),
  dialogSpeechEnabled: z.boolean(),
  dialogImageEnabled: z.boolean(),
  authEnabled: z.boolean(),
  authEndpointUrl: z.string(),
  corsAllowedOrigins: z.array(z.string()),
} satisfies Record<SettingsKey, z.ZodType>;

const hasDuplicateToolNames = (settings: {
  builtInTools: Array<{ name: string }>;
  tools: Array<{ name: string }>;
}) => {
  const names = [...settings.builtInTools, ...settings.tools].map((tool) => tool.name);

  return new Set(names).size !== names.length;
};

export const settingsBaseSchema = z.object(settingsFieldSchemaMap).strict();

export const settingsSchema = settingsBaseSchema.superRefine((settings, ctx) => {
  if (!hasDuplicateToolNames(settings)) {
    return;
  }

  ctx.addIssue({
    code: "custom",
    path: ["tools"],
    message: "Tool names must be unique",
  });
});

export const settingsResponseSchema = settingsSchema.extend({
  apiTokenMask: z.string(),
});

export const settingsPatchSchema = settingsBaseSchema
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
      name: "openai/gpt-5.4-nano",
      tags: ["text-generation", "tool-calling"],
    },
    {
      name: "@cf/zai-org/glm-4.7-flash",
      tags: ["text-generation", "tool-calling"],
    },
    {
      name: "openai/gpt-4o-transcribe",
      tags: ["speech-to-text"],
    },
    {
      name: "inworld/tts-2",
      tags: ["text-to-speech"],
    },
    {
      name: "@cf/qwen/qwen3-embedding-0.6b",
      tags: ["embedding"],
    },
  ],
  primaryModel: "openai/gpt-5.4-mini",
  toolPlannerModel: "openai/gpt-5.4-nano",
  embeddingModel: "@cf/qwen/qwen3-embedding-0.6b",
  builtInTools: BUILT_IN_TOOLS,
  primaryModelUsageLimit: {
    dailyInputLimit: 0,
    dailyOutputLimit: 0,
  },
  timeZone: "UTC+0",
  tools: [],
  globalPrompt: "",
  dialogSystemPrompt: "",
  dialogOpeningMessage: "",
  dialogSpeechEnabled: true,
  dialogImageEnabled: true,
  authEnabled: false,
  authEndpointUrl: "",
  corsAllowedOrigins: [],
} satisfies Settings;
