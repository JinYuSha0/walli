import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  BUILT_IN_TOOLS,
  DEFAULT_SETTINGS,
  primaryModelUsageLimitConfigSchema,
  settingsResponseSchema,
  timeZoneConfigSchema,
  toolConfigSchema,
} from "../../shared/const";
import { telegramSettingsPatchSchema } from "../../shared/client";
import { handleTelegramWebhookUpdate, telegramRoute } from "../api/telegram";
import { getSettings, settingsRoute } from "../api/settings";
import type { AppBindings } from "../api/types";
import { createChatRunnerTools } from "../lib/chat-runner";
import {
  buildChatTools,
  createLooseToolInputSchema,
  createToolInputSchema,
  isValidChatToolName,
} from "../lib/chat-tools.ts";
import { normalizeGatewayModelId } from "../lib/llm";
import { renderTelegramHtmlFromMarkdown } from "../lib/telegram-format";
import { extractVoiceOutput, type ImageToTextContext, type VoiceToTextContext } from "./media-tools";
import { toolsRoute } from ".";
import { getNextCronScheduledAt } from "./cron";

const env = {
  API_TOKEN: "test-token",
} as Env;
const voiceToTextTool = BUILT_IN_TOOLS.find((tool) => tool.name === "voice_to_text")!;
const textToVoiceTool = BUILT_IN_TOOLS.find((tool) => tool.name === "text_to_voice")!;
const imageToTextTool = BUILT_IN_TOOLS.find((tool) => tool.name === "image_to_text")!;
const aiRun = vi.fn(async (_model: string, input: Record<string, unknown>) => ({
  ok: true,
  input,
}));
const fakeRuntime = {
  AI: {
    run: aiRun,
  },
} as unknown as Parameters<typeof buildChatTools>[1];

const signTelegramFileUrl = async (
  secret: string,
  fileId: string,
  expires: string,
  filePath: string,
) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${fileId}.${expires}.${filePath}`),
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

describe("chat tools", () => {
  it("normalizes bare Workers AI model ids for AI Gateway", () => {
    expect(normalizeGatewayModelId("@cf/zai-org/glm-4.7-flash")).toBe(
      "workers-ai/@cf/zai-org/glm-4.7-flash",
    );
    expect(normalizeGatewayModelId("workers-ai/@cf/zai-org/glm-4.7-flash")).toBe(
      "workers-ai/@cf/zai-org/glm-4.7-flash",
    );
    expect(normalizeGatewayModelId("openai/gpt-5.4-mini")).toBe("openai/gpt-5.4-mini");
  });

  beforeEach(() => {
    aiRun.mockClear();
  });

  it("keeps the expected built-in tool order", () => {
    expect(BUILT_IN_TOOLS.map((toolConfig) => toolConfig.name)).toEqual([
      "timestamp",
      "scheduled_task",
      "voice_to_text",
      "text_to_voice",
      "image_to_text",
    ]);
    expect(DEFAULT_SETTINGS.tools).toEqual([]);
  });

  it("parses default settings with editable built-in tools", () => {
    expect(() =>
      settingsResponseSchema.parse({
        ...DEFAULT_SETTINGS,
        apiTokenMask: "test",
      }),
    ).not.toThrow();
  });

  it("rejects duplicate tool names across built-in and custom tools", () => {
    expect(() =>
      settingsResponseSchema.parse({
        ...DEFAULT_SETTINGS,
        tools: [
          {
            ...voiceToTextTool,
          },
        ],
        apiTokenMask: "test",
      }),
    ).toThrow("Tool names must be unique");
  });

  it("allows api tools without schema fields", () => {
    expect(() =>
      toolConfigSchema.parse({
        enabled: true,
        name: "empty_api",
        description: "API tool without input fields",
        invocation: {
          type: "api",
          url: "https://example.com/tool",
          method: "POST",
          headers: [],
        },
        schema: {
          fields: [],
        },
      }),
    ).not.toThrow();
  });

  it("still requires model tools to have a required schema field", () => {
    expect(() =>
      toolConfigSchema.parse({
        enabled: true,
        name: "empty_model",
        description: "Model tool without input fields",
        invocation: {
          type: "model",
          model: "openai/gpt-5.4-mini",
        },
        schema: {
          fields: [],
        },
      }),
    ).toThrow("At least one required schema field is required");
  });

  it("parses total usage limits", () => {
    expect(
      primaryModelUsageLimitConfigSchema.parse({
        dailyInputLimit: 10,
        dailyOutputLimit: 20,
      }),
    ).toEqual({
      dailyInputLimit: 10,
      dailyOutputLimit: 20,
    });
  });

  it("migrates legacy primary model daily usage fields", () => {
    expect(
      primaryModelUsageLimitConfigSchema.parse({
        perRequestInputLimit: 1,
        perRequestOutputLimit: 2,
        perUserDailyInputLimit: 30,
        perUserDailyOutputLimit: 40,
      }),
    ).toEqual({
      dailyInputLimit: 30,
      dailyOutputLimit: 40,
    });
  });

  it("parses UTC offset time zones and migrates UTC", () => {
    expect(timeZoneConfigSchema.parse(undefined)).toBe("UTC+0");
    expect(timeZoneConfigSchema.parse("UTC")).toBe("UTC+0");
    expect(timeZoneConfigSchema.parse("UTC+8")).toBe("UTC+8");
  });

  it("rejects invalid UTC offset time zones", () => {
    expect(() =>
      timeZoneConfigSchema.parse("Nope/Nowhere"),
    ).toThrow();
  });

  it("accepts bot_token as a Telegram settings patch alias", () => {
    expect(
      telegramSettingsPatchSchema.parse({
        bot_token: "123:abc",
      }),
    ).toEqual({
      botToken: "123:abc",
    });
  });

  it("keeps built-in tools before configured tools", () => {
    const tools = buildChatTools([...BUILT_IN_TOOLS, ...DEFAULT_SETTINGS.tools], fakeRuntime);

    expect(Object.keys(tools)).toEqual([
      "timestamp",
      "scheduled_task",
      "voice_to_text",
      "text_to_voice",
      "image_to_text",
    ]);
  });

  it("can exclude the scheduled task tool from generated runner tools", () => {
    const tools = createChatRunnerTools(
      DEFAULT_SETTINGS,
      {
        AI: fakeRuntime.AI,
        API_TOKEN: "test-token",
      } as Env,
      "https://example.com",
      ["scheduled_task"],
    );

    expect(Object.keys(tools)).toEqual([
      "timestamp",
      "voice_to_text",
      "text_to_voice",
      "image_to_text",
    ]);
  });

  it("can disable the scheduled task built-in tool through settings", () => {
    const tools = createChatRunnerTools(
      {
        ...DEFAULT_SETTINGS,
        builtInTools: DEFAULT_SETTINGS.builtInTools.map((tool) =>
          tool.name === "scheduled_task"
            ? {
                ...tool,
                enabled: false,
              }
            : tool,
        ),
      },
      {
        AI: fakeRuntime.AI,
        API_TOKEN: "test-token",
      } as Env,
      "https://example.com",
    );

    expect(Object.keys(tools)).toEqual([
      "timestamp",
      "voice_to_text",
      "text_to_voice",
      "image_to_text",
    ]);
  });

  it("creates input schema from default voice_to_text tool", () => {
    const schema = createToolInputSchema(voiceToTextTool);

    expect(
      schema.parse({
        file: "https://example.com/audio.mp3",
      }),
    ).toEqual({
      file: "https://example.com/audio.mp3",
    });
    expect(() => schema.parse({ language: "zh" })).toThrow();
  });

  it("accepts optional voice_to_text fields with configured types", () => {
    const schema = createToolInputSchema(voiceToTextTool);

    expect(
      schema.parse({
        file: "data:audio/mp3;base64,AAAA",
        language: "zh",
        prompt: "普通话对话",
        temperature: 0.2,
      }),
    ).toEqual({
      file: "data:audio/mp3;base64,AAAA",
      language: "zh",
      prompt: "普通话对话",
      temperature: 0.2,
    });
  });

  it("rejects unknown tool input fields", () => {
    const schema = createToolInputSchema(voiceToTextTool);

    expect(() =>
      schema.parse({
        file: "data:audio/ogg;base64,AAAA",
        mime_type: "audio/ogg",
      }),
    ).toThrow();
  });

  it("applies default values from default text_to_voice tool", () => {
    const schema = createToolInputSchema(textToVoiceTool);

    expect(
      schema.parse({
        text: "hello",
      }),
    ).toEqual({
      text: "hello",
      voice: "alloy",
      response_format: "mp3",
      speed: 1,
    });
  });

  it("validates default tool field types", () => {
    const schema = createToolInputSchema(textToVoiceTool);

    expect(() =>
      schema.parse({
        text: "hello",
        speed: "1",
      }),
    ).toThrow();
  });

  it("creates input schema from default image_to_text tool", () => {
    const schema = createToolInputSchema(imageToTextTool);

    expect(
      schema.parse({
        file: "https://example.com/image.png",
      }),
    ).toEqual({
      file: "https://example.com/image.png",
      prompt: "Describe the image and extract any visible text.",
    });
    expect(() => schema.parse({})).toThrow();
  });

  it("creates loose tool input schema for direct execution", () => {
    const schema = createLooseToolInputSchema(imageToTextTool);

    expect(
      schema.parse({
        file: "https://example.com/image.png",
        prompt: "Extract receipt text.",
        width: 100,
      }),
    ).toEqual({
      file: "https://example.com/image.png",
      prompt: "Extract receipt text.",
    });
  });

  it("accepts all default tool names as model-friendly names", () => {
    expect(BUILT_IN_TOOLS.every((toolConfig) => isValidChatToolName(toolConfig.name))).toBe(
      true,
    );
  });

  it("builds chat tools from default built-in tools", () => {
    const tools = buildChatTools(DEFAULT_SETTINGS.builtInTools, fakeRuntime);

    expect(Object.keys(tools)).toEqual([
      "timestamp",
      "scheduled_task",
      "voice_to_text",
      "text_to_voice",
      "image_to_text",
    ]);
  });

  it("skips disabled tools", () => {
    const tools = buildChatTools(
      [
        {
          ...voiceToTextTool,
          enabled: false,
        },
        textToVoiceTool,
      ],
      fakeRuntime,
    );

    expect(Object.keys(tools)).toEqual(["text_to_voice"]);
  });

  it("keeps default tool descriptions on generated chat tools", () => {
    const tools = buildChatTools(DEFAULT_SETTINGS.builtInTools, fakeRuntime);

    expect(tools.voice_to_text.description).toBe(voiceToTextTool.description);
    expect(tools.text_to_voice.description).toBe(textToVoiceTool.description);
    expect(tools.image_to_text.description).toBe(imageToTextTool.description);
  });

  it("executes default model tools through env.AI.run", async () => {
    const tools = buildChatTools(DEFAULT_SETTINGS.builtInTools, fakeRuntime);
    const executionOptions = {} as Parameters<NonNullable<typeof tools.voice_to_text.execute>>[1];

    await expect(
      tools.voice_to_text.execute?.(
        {
          file: "https://example.com/audio.mp3",
        },
        executionOptions,
      ),
    ).resolves.toEqual({
      ok: true,
      input: {
        file: "https://example.com/audio.mp3",
      },
    });
    expect(aiRun).toHaveBeenCalledWith("openai/gpt-4o-transcribe", {
      file: "https://example.com/audio.mp3",
    });

    await expect(
      tools.text_to_voice.execute?.(
        {
          text: "hello",
          voice: "alloy",
        },
        executionOptions,
      ),
    ).resolves.toEqual({
      ok: true,
      input: {
        text: "hello",
        voice: "alloy",
        response_format: "mp3",
        speed: 1,
      },
    });
    expect(aiRun).toHaveBeenLastCalledWith("openai/tts-1", {
      text: "hello",
      voice: "alloy",
      response_format: "mp3",
      speed: 1,
    });

    await expect(
      tools.image_to_text.execute?.(
        {
          file: "https://example.com/image.png",
        },
        executionOptions,
      ),
    ).resolves.toEqual({
      ok: true,
      input: {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe the image and extract any visible text.",
              },
              {
                type: "image_url",
                image_url: {
                  url: "https://example.com/image.png",
                },
              },
            ],
          },
        ],
      },
    });
    expect(aiRun).toHaveBeenLastCalledWith("openai/gpt-5.4-mini", {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe the image and extract any visible text.",
            },
            {
              type: "image_url",
              image_url: {
                url: "https://example.com/image.png",
              },
            },
          ],
        },
      ],
    });
  });

  it("validates tool input before execution", async () => {
    const tools = buildChatTools([voiceToTextTool], fakeRuntime);
    const executionOptions = {} as Parameters<NonNullable<typeof tools.voice_to_text.execute>>[1];

    await expect(
      tools.voice_to_text.execute?.(
        {
          file: "data:audio/ogg;base64,AAAA",
          mime_type: "audio/ogg",
        },
        executionOptions,
      ),
    ).rejects.toThrow();
    expect(aiRun).not.toHaveBeenCalled();
  });

  it("requires object input for tools without schema fields", async () => {
    const tools = buildChatTools(
      [
        {
          ...voiceToTextTool,
          schema: {
            fields: [],
          },
        },
      ],
      fakeRuntime,
    );
    const executionOptions = {} as Parameters<NonNullable<typeof tools.voice_to_text.execute>>[1];

    await expect(tools.voice_to_text.execute?.("raw text", executionOptions)).rejects.toThrow();
    await expect(tools.voice_to_text.execute?.({}, executionOptions)).resolves.toEqual({
      ok: true,
      input: {},
    });
    expect(aiRun).toHaveBeenCalledWith("openai/gpt-4o-transcribe", {});
  });

  it("returns image model results without extracting text", async () => {
    const modelResult = {
      choices: [
        {
          message: {
            content: "The image shows a receipt.",
          },
        },
      ],
    };
    aiRun.mockResolvedValueOnce(modelResult);
    const tools = buildChatTools([imageToTextTool], fakeRuntime);
    const executionOptions = {} as Parameters<NonNullable<typeof tools.image_to_text.execute>>[1];

    await expect(
      tools.image_to_text.execute?.(
        {
          file: "https://example.com/image.png",
        },
        executionOptions,
      ),
    ).resolves.toBe(modelResult);
  });

  it("executes api tools with request input", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const tools = buildChatTools(
      [
        {
          ...voiceToTextTool,
          invocation: {
            type: "api",
            url: "https://example.com/tool",
            method: "POST",
            headers: [
              {
                name: "x-api-key",
                defaultValue: "secret",
              },
            ],
          },
          schema: {
            fields: [
              ...voiceToTextTool.schema.fields,
              {
                name: "format",
                type: "string",
                description: "Response format",
                required: false,
                defaultValue: "json",
              },
              {
                name: "include_timestamps",
                type: "boolean",
                description: "Whether to include timestamps",
                required: false,
                defaultValue: "true",
              },
            ],
          },
        },
      ],
      fakeRuntime,
    );
    const executionOptions = {} as Parameters<NonNullable<typeof tools.voice_to_text.execute>>[1];

    await expect(
      tools.voice_to_text.execute?.(
        {
          file: "https://example.com/audio.mp3",
        },
        executionOptions,
      ),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://example.com/tool"),
      {
        method: "POST",
        headers: {
          "x-api-key": "secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          format: "json",
          include_timestamps: true,
          file: "https://example.com/audio.mp3",
        }),
      },
    );
    fetchMock.mockRestore();
  });

  it("executes api tools through the runtime fetch when provided", async () => {
    const runtimeFetch = vi.fn(async () =>
      new Response(JSON.stringify({ timestamp: 123 }), {
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const tools = buildChatTools(
      [
        {
          ...voiceToTextTool,
          invocation: {
            type: "api",
            url: "https://example.com/api/tools/timestamp",
            method: "GET",
            headers: [
              {
                name: "authorization",
                defaultValue: "Bearer test-token",
              },
            ],
          },
          schema: {
            fields: [],
          },
        },
      ],
      {
        ...fakeRuntime,
        fetch: runtimeFetch,
      },
    );
    const executionOptions = {} as Parameters<NonNullable<typeof tools.voice_to_text.execute>>[1];

    await expect(tools.voice_to_text.execute?.({}, executionOptions)).resolves.toEqual({
      timestamp: 123,
    });
    expect(runtimeFetch).toHaveBeenCalledWith(
      new URL("https://example.com/api/tools/timestamp"),
      {
        method: "GET",
        headers: {
          authorization: "Bearer test-token",
        },
      },
    );
  });
});

describe("tools route", () => {
  it("calculates the next monthly cron run in the requested time zone", () => {
    const nextRun = getNextCronScheduledAt(
      "0 17 1 * *",
      "Asia/Shanghai",
      Date.parse("2026-01-02T00:00:00.000Z"),
    );

    expect(new Date(nextRun).toISOString()).toBe("2026-02-01T09:00:00.000Z");
  });

  it("rejects timestamp requests without the internal API token", async () => {
    const response = await toolsRoute.request("/api/tools/timestamp", {}, env);

    expect(response.status).toBe(403);
  });

  it("returns the current timestamp with the requested time zone", async () => {
    const response = await toolsRoute.request(
      "/api/tools/timestamp?timeZone=Asia%2FShanghai",
      {
        headers: {
          authorization: "Bearer test-token",
        },
      },
      env,
    );
    const body = await response.json() as {
      timestamp: number;
      unixSeconds: number;
      iso: string;
      timeZone: string;
      datetime: string;
    };

    expect(response.status).toBe(200);
    expect(body.timestamp).toBeGreaterThan(0);
    expect(body.unixSeconds).toBe(Math.floor(body.timestamp / 1000));
    expect(body.iso).toBe(new Date(body.timestamp).toISOString());
    expect(body.timeZone).toBe("Asia/Shanghai");
    expect(body.datetime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("rejects invalid time zones", async () => {
    const response = await toolsRoute.request(
      "/api/tools/timestamp?timeZone=Nope%2FNowhere",
      {
        headers: {
          authorization: "Bearer test-token",
        },
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("creates recurring scheduled tasks with end and retry options", async () => {
    const createTask = vi.fn(async (input) => ({
      ...input,
      id: "task-1",
      recurrenceEndAt: input.recurrenceEndAt ?? null,
      maxRuns: input.maxRuns ?? null,
      runNumber: input.runNumber ?? 1,
      maxRetry: input.maxRetry ?? 1,
      retryCount: input.retryCount ?? 0,
      status: "pending",
      createdAt: 0,
      updatedAt: 0,
      executedAt: null,
      canceledAt: null,
      lastError: null,
    }));
    const scheduledTaskEnv = {
      ...env,
      USER: {
        getByName: vi.fn(() => ({
          createTask,
        })),
      },
    } as unknown as Env;

    const response = await toolsRoute.request(
      "/api/tools/scheduled-tasks",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          userId: "user-1",
          type: "reminder",
          description: "Send the weekly report reminder.",
          scheduledAt: 1000,
          cron: "0 17 * * 1",
          timeZone: "Asia/Shanghai",
          recurrenceEndAt: 100000,
          maxRuns: 3,
          maxRetry: 2,
          payload: {
            channel: "email",
          },
        }),
      },
      scheduledTaskEnv,
    );

    expect(response.status).toBe(201);
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        description: "Send the weekly report reminder.",
        scheduledAt: 1000,
        cron: "0 17 * * 1",
        timeZone: "Asia/Shanghai",
        recurrenceEndAt: 100000,
        maxRuns: 3,
        maxRetry: 2,
      }),
    );
  });

  it("lists pending scheduled tasks by default", async () => {
    const listTasks = vi.fn(async () => []);
    const scheduledTaskEnv = {
      ...env,
      USER: {
        getByName: vi.fn(() => ({
          listTasks,
        })),
      },
    } as unknown as Env;

    const response = await toolsRoute.request(
      "/api/tools/scheduled-tasks",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "list",
          userId: "user-1",
        }),
      },
      scheduledTaskEnv,
    );

    expect(response.status).toBe(200);
    expect(listTasks).toHaveBeenCalledWith("pending");
  });

  it("supports listing scheduled tasks across all statuses", async () => {
    const listTasks = vi.fn(async () => []);
    const scheduledTaskEnv = {
      ...env,
      USER: {
        getByName: vi.fn(() => ({
          listTasks,
        })),
      },
    } as unknown as Env;

    const response = await toolsRoute.request(
      "/api/tools/scheduled-tasks",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "list",
          userId: "user-1",
          status: "all",
        }),
      },
      scheduledTaskEnv,
    );

    expect(response.status).toBe(200);
    expect(listTasks).toHaveBeenCalledWith("all");
  });

  it("rejects recurring scheduled tasks with an invalid end time", async () => {
    const response = await toolsRoute.request(
      "/api/tools/scheduled-tasks",
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          userId: "user-1",
          description: "Send the weekly report reminder.",
          scheduledAt: 1000,
          cron: "0 17 * * 1",
          recurrenceEndAt: 1000,
        }),
      },
      env,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).toContain("recurrenceEndAt must be greater than scheduledAt");
  });
});

describe("settings tool migration", () => {
  it("moves legacy default model tools into built-in tools", async () => {
    const savedSettings = {
      ...DEFAULT_SETTINGS,
      builtInTools: DEFAULT_SETTINGS.builtInTools.map((tool) => ({
        name: tool.name,
        enabled: tool.name !== "voice_to_text",
      })),
      tools: [voiceToTextTool],
    };
    const put = vi.fn();
    const appKv = {
      get: vi.fn(async (key: string) => key === "settings" ? savedSettings : null),
      put,
    } as unknown as KVNamespace;
    const settings = await getSettings(appKv);

    expect(settings.builtInTools.map((tool) => tool.name)).toEqual([
      "timestamp",
      "scheduled_task",
      "voice_to_text",
      "text_to_voice",
      "image_to_text",
    ]);
    expect(settings.builtInTools.find((tool) => tool.name === "voice_to_text")?.enabled).toBe(
      true,
    );
    expect(settings.tools).toEqual([]);
  });

  it("moves legacy usage time zone into the top-level setting", async () => {
    const savedSettings: Record<string, unknown> = {
      ...DEFAULT_SETTINGS,
      primaryModelUsageLimit: {
        dailyInputLimit: 0,
        dailyOutputLimit: 0,
        timeZone: "Asia/Shanghai",
      },
    };
    delete savedSettings.timeZone;
    const appKv = {
      get: vi.fn(async (key: string) => key === "settings" ? savedSettings : null),
      put: vi.fn(),
    } as unknown as KVNamespace;
    const settings = await getSettings(appKv);

    expect(settings.primaryModelUsageLimit).toEqual({
      dailyInputLimit: 0,
      dailyOutputLimit: 0,
    });
    expect(settings.timeZone).toBe("UTC+8");
  });

  it("adds the default tool planner model to legacy full settings", async () => {
    const savedSettings: Record<string, unknown> = {
      ...DEFAULT_SETTINGS,
    };
    delete savedSettings.toolPlannerModel;
    const appKv = {
      get: vi.fn(async (key: string) => key === "settings" ? savedSettings : null),
      put: vi.fn(),
    } as unknown as KVNamespace;
    const settings = await getSettings(appKv);

    expect(settings.toolPlannerModel).toBe("openai/gpt-5.4-nano");
  });

  it("applies built-in model input adapters to tools loaded from settings", async () => {
    const savedSettings: Record<string, unknown> = {
      ...DEFAULT_SETTINGS,
      builtInTools: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.builtInTools)) as unknown,
    };
    const appKv = {
      get: vi.fn(async (key: string) => key === "settings" ? savedSettings : null),
      put: vi.fn(),
    } as unknown as KVNamespace;
    const settings = await getSettings(appKv);
    const tools = buildChatTools(settings.builtInTools, fakeRuntime);
    const executionOptions = {} as Parameters<NonNullable<typeof tools.image_to_text.execute>>[1];

    await tools.image_to_text.execute?.(
      {
        file: "https://example.com/image.png",
      },
      executionOptions,
    );

    expect(aiRun).toHaveBeenLastCalledWith("openai/gpt-5.4-mini", {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe the image and extract any visible text.",
            },
            {
              type: "image_url",
              image_url: {
                url: "https://example.com/image.png",
              },
            },
          ],
        },
      ],
    });
  });

  it("resets all settings KV entries", async () => {
    const deletedKeys: string[] = [];
    const appKv = {
      get: vi.fn(async () => null),
      put: vi.fn(),
      delete: vi.fn(async (key: string) => {
        deletedKeys.push(key);
      }),
    } as unknown as KVNamespace;
    const app = new Hono<AppBindings>()
      .use("*", async (c, next) => {
        c.set("user", {
          email: "admin@example.com",
          role: "admin",
        } as AppBindings["Variables"]["user"]);
        await next();
      })
      .route("/", settingsRoute);
    const response = await app.request(
      "/api/admin/settings",
      {
        method: "DELETE",
      },
      {
        APP_KV: appKv,
        API_TOKEN: "test-token",
      } as Env,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.primaryModel).toBe(DEFAULT_SETTINGS.primaryModel);
    expect(body.toolPlannerModel).toBe(DEFAULT_SETTINGS.toolPlannerModel);
    expect(deletedKeys).toEqual(
      expect.arrayContaining([
        "settings",
        "settings:models",
        "settings:primary-model",
        "settings:tool-planner-model",
        "settings:system-prompt",
        "settings:usage-limits",
      ]),
    );
  });
});

describe("Telegram formatting", () => {
  it("renders common Markdown as Telegram HTML", () => {
    expect(
      renderTelegramHtmlFromMarkdown(
        [
          "## Title",
          "",
          "**bold** and _italic_ with `code`.",
          "",
          "- first",
          "- [x] done",
          "",
          "[OpenAI](https://openai.com)",
          "",
          "```ts",
          "const value = 1 < 2;",
          "```",
        ].join("\n"),
      ),
    ).toBe(
      [
        "<b>Title</b>",
        "",
        "<b>bold</b> and <i>italic</i> with <code>code</code>.",
        "",
        "- first\n- [x] done",
        "",
        '<a href="https://openai.com">OpenAI</a>',
        "",
        "<pre><code>const value = 1 &lt; 2;</code></pre>",
      ].join("\n"),
    );
  });
});

describe("telegram webhook", () => {
  it("extracts Cloudflare TTS result audio URLs for Telegram voice replies", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("voice-bytes", {
        headers: {
          "content-type": "audio/ogg",
        },
      }),
    );
    const output = await extractVoiceOutput({
        gatewayMetadata: {
          keySource: "Unified",
        },
        result: {
          audio: "https://example.com/reply.mp3",
        },
        state: "Completed",
      });

    expect(output.type).toBe("blob");
    expect(output.filename).toBe("reply.ogg");
    expect(output.voice).toBeInstanceOf(Blob);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/reply.mp3");
    fetchMock.mockRestore();
  });

  it("proxies Telegram files with a filename suffix and forced content type", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("voice-bytes", {
        headers: {
          "content-type": "application/octet-stream",
        },
      }),
    );
    const appKv = {
      get: vi.fn(async (key: string) =>
        key === "client:telegram:settings"
          ? {
              botToken: "test-token",
            }
          : null,
      ),
      put: vi.fn(),
    } as unknown as KVNamespace;
    const fileId = "voice-file";
    const filePath = "voice/file_16.oga";
    const expires = String(Date.now() + 60_000);
    const signature = await signTelegramFileUrl("api-token", fileId, expires, filePath);
    const response = await telegramRoute.fetch(
      new Request(
        `https://chat.test/api/telegram/file/${filePath}?fileId=${fileId}&expires=${expires}&signature=${signature}`,
      ),
      {
        API_TOKEN: "api-token",
        APP_KV: appKv,
      } as Env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/ogg");
    expect(await response.text()).toBe("voice-bytes");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("https://api.telegram.org/file/bottest-token/voice/file_16.oga");
    fetchMock.mockRestore();
  });

  it("shows typing, then sends the LLM text response", async () => {
    const calls: string[] = [];
    const sendMessage = vi.fn();
    const sendVoice = vi.fn();
    const sendChatAction = vi.fn(async (_chatId: string, action: "typing") => {
      calls.push(`action:${action}`);
    });
    const runLlm = vi.fn(async (_message, messages) => {
      calls.push("llm");
      expect(JSON.stringify(messages)).toContain("Message text: hello");
      return {
        type: "text" as const,
        text: "hello back",
      };
    });
    const getFileUrl = vi.fn();
    const markMessageRead = vi.fn();

    await handleTelegramWebhookUpdate(
      {
        update_id: 1,
        message: {
          message_id: 10,
          text: "hello",
          chat: {
            id: 123,
          },
          from: {
            id: 456,
            first_name: "Ada",
          },
        },
      },
      {
        sendMessage,
        sendVoice,
        sendChatAction,
        getFileUrl,
        markMessageRead,
        runLlm,
      },
    );

    expect(calls).toEqual(["action:typing", "llm"]);
    expect(markMessageRead).toHaveBeenCalledOnce();
    expect(sendChatAction).toHaveBeenCalledWith("123", "typing");
    expect(sendMessage).toHaveBeenCalledWith("123", "hello back");
    expect(sendVoice).not.toHaveBeenCalled();
  });

  it("marks business messages as read before handling them", async () => {
    const calls: string[] = [];
    const sendMessage = vi.fn();
    const sendVoice = vi.fn();
    const sendChatAction = vi.fn(async () => {
      calls.push("action");
    });
    const getFileUrl = vi.fn();
    const markMessageRead = vi.fn(async () => {
      calls.push("read");
    });
    const runLlm = vi.fn(async () => {
      calls.push("llm");
      return {
        type: "text" as const,
        text: "ok",
      };
    });

    await handleTelegramWebhookUpdate(
      {
        update_id: 1,
        message: {
          message_id: 10,
          business_connection_id: "business-connection",
          text: "hello",
          chat: {
            id: 123,
          },
        },
      },
      {
        sendMessage,
        sendVoice,
        sendChatAction,
        getFileUrl,
        markMessageRead,
        runLlm,
      },
    );

    expect(calls).toEqual(["read", "action", "llm"]);
    expect(markMessageRead).toHaveBeenCalledWith(
      expect.objectContaining({
        business_connection_id: "business-connection",
        message_id: 10,
      }),
    );
  });

  it("sends voice when the LLM chooses a voice reply", async () => {
    const calls: string[] = [];
    const sendMessage = vi.fn();
    const sendVoice = vi.fn();
    const sendChatAction = vi.fn(async (_chatId: string, action: "typing" | "record_voice") => {
      calls.push(`action:${action}`);
    });
    const synthesizeVoice = vi.fn(async (text: string) => {
      calls.push("synthesize");
      expect(text).toBe("voice reply");
      return {
        type: "blob" as const,
        voice: new Blob(["voice"]),
        filename: "reply.ogg",
      };
    });
    const runLlm = vi.fn(async (_message, messages) => {
      calls.push("llm");
      expect(JSON.stringify(messages)).toContain("Message text: say it as voice");
      return {
        type: "voice" as const,
        text: "voice reply",
      };
    });
    const getFileUrl = vi.fn();
    const markMessageRead = vi.fn();

    await handleTelegramWebhookUpdate(
      {
        update_id: 1,
        message: {
          message_id: 10,
          text: "say it as voice",
          chat: {
            id: 123,
          },
        },
      },
      {
        sendMessage,
        sendVoice,
        sendChatAction,
        getFileUrl,
        markMessageRead,
        synthesizeVoice,
        runLlm,
      },
    );

    expect(calls).toEqual(["action:typing", "llm", "action:record_voice", "synthesize"]);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(sendVoice).toHaveBeenCalledOnce();
  });

  it("transcribes voice files before one LLM response and sends the selected text reply", async () => {
    const calls: string[] = [];
    const sendMessage = vi.fn();
    const sendVoice = vi.fn();
    const sendChatAction = vi.fn(async (_chatId: string, action: "typing" | "record_voice") => {
      calls.push(`action:${action}`);
    });
    const getFileUrl = vi.fn(async () => {
      calls.push("file");
      return "https://chat.test/api/telegram/file/voice/file_12.oga?fileId=voice-file&expires=1&signature=test";
    });
    const transcribeVoice = vi.fn(async (context: VoiceToTextContext) => {
      calls.push("transcribe");
      expect(context.file).toContain(
        "https://chat.test/api/telegram/file/voice/file_12.oga?fileId=voice-file",
      );
      expect(context).not.toHaveProperty("mimeType");
      expect(context).not.toHaveProperty("duration");
      return {
        text: "你好",
      };
    });
    const synthesizeVoice = vi.fn(async (text: string) => {
      calls.push("synthesize");
      expect(text).toBe("voice reply");
      return {
        type: "blob" as const,
        voice: new Blob(["voice"]),
        filename: "reply.ogg",
      };
    });
    const markMessageRead = vi.fn();
    const runLlm = vi.fn(async (_message, messages) => {
      calls.push("llm");
      const serializedMessages = JSON.stringify(messages);
      expect(serializedMessages).toContain("Voice transcription result");
      expect(serializedMessages).toContain("你好");
      expect(serializedMessages).not.toContain("api.telegram.org/file/bot");
      return {
        type: "text" as const,
        text: "text reply",
      };
    });

    await handleTelegramWebhookUpdate(
      {
        update_id: 1,
        message: {
          message_id: 10,
          chat: {
            id: 123,
          },
          voice: {
            file_id: "voice-file",
            mime_type: "audio/ogg",
          },
        },
      },
      {
        sendMessage,
        sendVoice,
        sendChatAction,
        getFileUrl,
        markMessageRead,
        transcribeVoice,
        synthesizeVoice,
        runLlm,
      },
    );

    expect(calls).toEqual(["action:typing", "file", "transcribe", "llm"]);
    expect(synthesizeVoice).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith("123", "text reply");
    expect(sendVoice).not.toHaveBeenCalled();
  });

  it("describes image files before one LLM response and sends text", async () => {
    const calls: string[] = [];
    const sendMessage = vi.fn();
    const sendVoice = vi.fn();
    const sendChatAction = vi.fn(async () => {
      calls.push("action");
    });
    const getFileUrl = vi.fn(async () => {
      calls.push("file");
      return "https://chat.test/api/telegram/file/photos/file_1.jpg?fileId=photo-file&expires=1&signature=test";
    });
    const describeImage = vi.fn(async (context: ImageToTextContext) => {
      calls.push("describe");
      expect(context.file).toContain(
        "https://chat.test/api/telegram/file/photos/file_1.jpg?fileId=photo-file",
      );
      expect(context.prompt).toBe(
        "Describe this Telegram image and extract any visible text. Caption: what is this",
      );
      expect(context).not.toHaveProperty("caption");
      expect(context).not.toHaveProperty("width");
      return {
        text: "A receipt image",
      };
    });
    const markMessageRead = vi.fn();
    const runLlm = vi.fn(async (_message, messages) => {
      calls.push("llm");
      const serializedMessages = JSON.stringify(messages);
      expect(serializedMessages).toContain("Message text: what is this");
      expect(serializedMessages).toContain("Image recognition result");
      expect(serializedMessages).toContain("A receipt image");
      expect(serializedMessages).not.toContain("api.telegram.org/file/bot");
      return {
        type: "text" as const,
        text: "image reply",
      };
    });

    await handleTelegramWebhookUpdate(
      {
        update_id: 1,
        message: {
          message_id: 10,
          caption: "what is this",
          chat: {
            id: 123,
          },
          photo: [
            {
              file_id: "photo-file",
              width: 100,
              height: 100,
            },
          ],
        },
      },
      {
        sendMessage,
        sendVoice,
        sendChatAction,
        getFileUrl,
        markMessageRead,
        describeImage,
        runLlm,
      },
    );

    expect(calls).toEqual(["action", "file", "describe", "llm"]);
    expect(sendMessage).toHaveBeenCalledWith("123", "image reply");
    expect(sendVoice).not.toHaveBeenCalled();
  });

  it("replies with English text when voice file preparation fails", async () => {
    const sendMessage = vi.fn();
    const sendVoice = vi.fn();
    const sendChatAction = vi.fn();
    const getFileUrl = vi.fn(async () => {
      throw new Error("download failed");
    });
    const markMessageRead = vi.fn();
    const runLlm = vi.fn();

    await handleTelegramWebhookUpdate(
      {
        update_id: 1,
        message: {
          message_id: 10,
          chat: {
            id: 123,
          },
          voice: {
            file_id: "voice-file",
          },
        },
      },
      {
        sendMessage,
        sendVoice,
        sendChatAction,
        getFileUrl,
        markMessageRead,
        runLlm,
      },
    );

    expect(sendMessage).toHaveBeenCalledWith(
      "123",
      "Sorry, I couldn't process this audio message.",
    );
    expect(runLlm).not.toHaveBeenCalled();
    expect(sendVoice).not.toHaveBeenCalled();
  });

  it("replies with English text when image file preparation fails", async () => {
    const sendMessage = vi.fn();
    const sendVoice = vi.fn();
    const sendChatAction = vi.fn();
    const getFileUrl = vi.fn(async () => {
      throw new Error("download failed");
    });
    const markMessageRead = vi.fn();
    const runLlm = vi.fn();

    await handleTelegramWebhookUpdate(
      {
        update_id: 1,
        message: {
          message_id: 10,
          chat: {
            id: 123,
          },
          photo: [
            {
              file_id: "photo-file",
              width: 100,
              height: 100,
            },
          ],
        },
      },
      {
        sendMessage,
        sendVoice,
        sendChatAction,
        getFileUrl,
        markMessageRead,
        runLlm,
      },
    );

    expect(sendMessage).toHaveBeenCalledWith(
      "123",
      "Sorry, I couldn't process this image message.",
    );
    expect(runLlm).not.toHaveBeenCalled();
    expect(sendVoice).not.toHaveBeenCalled();
  });

  it("ignores Telegram updates without text messages", async () => {
    const sendMessage = vi.fn();
    const sendVoice = vi.fn();
    const sendChatAction = vi.fn();
    const getFileUrl = vi.fn();
    const markMessageRead = vi.fn();
    const runLlm = vi.fn();

    await handleTelegramWebhookUpdate(
      {
        update_id: 1,
      },
      {
        sendMessage,
        sendVoice,
        sendChatAction,
        getFileUrl,
        markMessageRead,
        runLlm,
      },
    );

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sendVoice).not.toHaveBeenCalled();
    expect(sendChatAction).not.toHaveBeenCalled();
    expect(runLlm).not.toHaveBeenCalled();
  });
});
