import { dynamicTool, generateText, isStepCount, type ToolSet } from "ai";
import { z } from "zod";
import {
  TOOL_NAME_PATTERN,
  type ToolConfig,
  type ToolSchemaField,
  type ToolSchemaFieldType,
} from "../../shared/const";
import { adaptBuiltInToolModelInput, adaptBuiltInToolModelOutput } from "../../shared/tools";
import { createTemporaryAssetUrl } from "../utils/llm";
import { toolsRoute } from "../tools";
import { bindAsyncContext, getAsyncContext } from "./async-context";

type ToolExecutionOptions = Parameters<NonNullable<ToolSet[string]["execute"]>>[1];

type RunToolWithContextOptions = {
  model?: Parameters<typeof generateText>[0]["model"];
  toolName: string;
  tool: ToolSet[string];
  toolConfig?: ToolConfig;
  taskContext: unknown;
  toolCallId?: string;
};

const parseDefaultValue = (fieldType: ToolSchemaFieldType, value: string): unknown => {
  if (value.length === 0) {
    return undefined;
  }

  if (fieldType === "number") {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  if (fieldType === "boolean") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return undefined;
  }

  if (fieldType === "array" || fieldType === "object") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  return value;
};

const createFieldSchema = (field: ToolSchemaField) => {
  const baseSchemaMap = {
    string: z.string(),
    number: z.number(),
    boolean: z.boolean(),
    array: z.array(z.unknown()),
    object: z.record(z.string(), z.unknown()),
  } satisfies Record<ToolSchemaFieldType, z.ZodType>;
  const describedSchema = baseSchemaMap[field.type].describe(field.description) as z.ZodType;
  const defaultValue = parseDefaultValue(field.type, field.defaultValue);

  if (field.required) {
    return describedSchema;
  }

  if (defaultValue !== undefined) {
    return describedSchema.optional().default(defaultValue);
  }

  return describedSchema.optional();
};

export const isValidChatToolName = (name: string) => TOOL_NAME_PATTERN.test(name);

export const createToolInputSchema = (toolConfig: ToolConfig) =>
  z
    .object(
      Object.fromEntries(
        toolConfig.schema.fields.map((field) => [field.name, createFieldSchema(field)]),
      ),
    )
    .strict();

export const createLooseToolInputSchema = (toolConfig: ToolConfig) =>
  z.object(
    Object.fromEntries(
      toolConfig.schema.fields.map((field) => [field.name, createFieldSchema(field)]),
    ),
  );

const createApiInvocationInput = (toolConfig: ToolConfig, input: unknown) => {
  const schemaDefaults = Object.fromEntries(
    toolConfig.schema.fields
      .map((field) => [field.name, parseDefaultValue(field.type, field.defaultValue)] as const)
      .filter(([, value]) => value !== undefined),
  );

  if (typeof input === "object" && input !== null) {
    return {
      ...schemaDefaults,
      ...(input as Record<string, unknown>),
    };
  }

  return {
    ...schemaDefaults,
    input,
  };
};


const createToolPlanningContext = (taskContext: unknown) => {
  const now = Date.now();

  return {
    taskContext,
    toolRuntimeContext: {
      currentUnixTimestampMs: now,
      currentIsoDatetime: new Date(now).toISOString(),
      timePolicy:
        "Use this execution-time current timestamp as now. Do not use timestamps from previous messages as the current time.",
    },
  };
};

const runConfiguredTool = async (toolConfig: ToolConfig, input: unknown): Promise<unknown> => {
  const { env } = getAsyncContext();
  const parsedInput = createToolInputSchema(toolConfig).parse(input);

  if (toolConfig.invocation.type === "model") {
    const resolvedInput = await addTemporaryImageAccess(toolConfig.name, parsedInput);
    const modelInput = adaptBuiltInToolModelInput(toolConfig.name, resolvedInput);
    const output = await env.AI.run(toolConfig.invocation.model, modelInput);

    return adaptBuiltInToolModelOutput(toolConfig.name, output);
  }

  const url = new URL(toolConfig.invocation.url);
  const apiInput = createApiInvocationInput(
    toolConfig,
    parsedInput,
  );
  const headers = Object.fromEntries(
    toolConfig.invocation.headers.map((header) => [header.name, header.defaultValue]),
  );
  const init: RequestInit = {
    method: toolConfig.invocation.method,
    headers,
  };

  if (toolConfig.invocation.method === "GET") {
    Object.entries(apiInput).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  } else {
    init.headers = {
      ...headers,
      "content-type": "application/json",
    };
    init.body = JSON.stringify(apiInput);
  }

  const response = await fetchToolRequest(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body,
    };
  }

  return body;
};

async function addTemporaryImageAccess(
  toolName: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (toolName !== "image_to_text" || !Array.isArray(input.file)) return input;
  const { env, origin } = getAsyncContext();

  return {
    ...input,
    file: await Promise.all(
      input.file.map((value) =>
        typeof value === "string" ? createTemporaryAssetUrl(value, origin, env.API_TOKEN) : value,
      ),
    ),
  };
}

const fetchToolRequest = (url: URL, init: RequestInit): Promise<Response> => {
  const { env, origin } = getAsyncContext();
  if (url.origin === origin && url.pathname.startsWith("/api/tools/")) {
    return Promise.resolve(toolsRoute.fetch(new Request(url, init), env));
  }

  return fetch(url, init);
};

export const buildChatTools = (toolConfigs: ToolConfig[]): ToolSet => {
  const entries = toolConfigs
    .filter((toolConfig) => toolConfig.enabled !== false && isValidChatToolName(toolConfig.name))
    .map((toolConfig) => [
      toolConfig.name,
      dynamicTool({
        description: toolConfig.description,
        inputSchema: createToolInputSchema(toolConfig),
        execute: bindAsyncContext((input) => runConfiguredTool(toolConfig, input)),
      }),
    ]);

  return Object.fromEntries(entries) as ToolSet;
};

export const runToolWithContext = async ({
  model,
  toolName,
  tool,
  toolConfig,
  taskContext,
  toolCallId = `tool_${toolName}`,
}: RunToolWithContextOptions) => {
  if (!tool.execute) {
    throw new Error(`${toolName} is not executable`);
  }

  const toolExecutionOptions = {
    toolCallId,
    messages: [],
    context: undefined,
  } satisfies ToolExecutionOptions;

  if (toolConfig) {
    const directInput = createLooseToolInputSchema(toolConfig)
      .pipe(createToolInputSchema(toolConfig))
      .safeParse(taskContext);

    if (directInput.success) {
      return tool.execute(directInput.data, toolExecutionOptions);
    }
  }

  if (!model) {
    throw new Error(`${toolName} requires a planner model to infer tool input`);
  }

  const result = await generateText({
    model,
    instructions: [
      `Call the ${toolName} tool exactly once.`,
      "Infer the tool input from taskContext and the tool schema.",
      "Use toolRuntimeContext.currentUnixTimestampMs as the current time whenever current time is needed.",
      "Do not answer directly.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: JSON.stringify(createToolPlanningContext(taskContext)),
      },
    ],
    tools: {
      [toolName]: tool,
    },
    toolChoice: {
      type: "tool",
      toolName,
    },
    stopWhen: isStepCount(1),
  });

  const output = result.toolResults[0]?.output;

  if (output === undefined) {
    throw new Error(`${toolName} did not return a result`);
  }

  return output;
};
