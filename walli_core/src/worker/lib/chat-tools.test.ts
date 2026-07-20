import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_TOOLS, DEFAULT_SETTINGS } from "../../shared/const";
import { buildChatTools, createToolInputSchema, isValidChatToolName } from "./chat-tools.ts";

const [voiceToTextTool, textToVoiceTool] = DEFAULT_SETTINGS.tools;
const imageToTextTool = DEFAULT_SETTINGS.tools[2];
const aiRun = vi.fn(async (_model: string, input: Record<string, unknown>) => ({
  ok: true,
  input,
}));
const fakeRuntime = {
  AI: {
    run: aiRun,
  },
} as unknown as Parameters<typeof buildChatTools>[1];

describe("chat tools", () => {
  beforeEach(() => {
    aiRun.mockClear();
  });

  it("keeps the expected default tool order", () => {
    expect(DEFAULT_SETTINGS.tools.map((toolConfig) => toolConfig.name)).toEqual([
      "voice_to_text",
      "text_to_voice",
      "image_to_text",
    ]);
  });

  it("keeps built-in tools before configured tools", () => {
    const tools = buildChatTools([...BUILT_IN_TOOLS, ...DEFAULT_SETTINGS.tools], fakeRuntime);

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
    });
    expect(() => schema.parse({})).toThrow();
  });

  it("accepts all default tool names as model-friendly names", () => {
    expect(DEFAULT_SETTINGS.tools.every((toolConfig) => isValidChatToolName(toolConfig.name))).toBe(
      true,
    );
  });

  it("builds chat tools from default settings tools", () => {
    const tools = buildChatTools(DEFAULT_SETTINGS.tools, fakeRuntime);

    expect(Object.keys(tools)).toEqual(["voice_to_text", "text_to_voice", "image_to_text"]);
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
    const tools = buildChatTools(DEFAULT_SETTINGS.tools, fakeRuntime);

    expect(tools.voice_to_text.description).toBe(voiceToTextTool.description);
    expect(tools.text_to_voice.description).toBe(textToVoiceTool.description);
    expect(tools.image_to_text.description).toBe(imageToTextTool.description);
  });

  it("executes default model tools through env.AI.run", async () => {
    const tools = buildChatTools(DEFAULT_SETTINGS.tools, fakeRuntime);
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
      },
    });
    expect(aiRun).toHaveBeenLastCalledWith("openai/tts-1", {
      text: "hello",
      voice: "alloy",
    });

    await expect(
      tools.image_to_text.execute?.(
        {
          file: "https://example.com/image.png",
          prompt: "describe",
        },
        executionOptions,
      ),
    ).resolves.toEqual({
      ok: true,
      input: {
        file: "https://example.com/image.png",
        prompt: "describe",
      },
    });
    expect(aiRun).toHaveBeenLastCalledWith("openai/gpt-5.4-mini", {
      file: "https://example.com/image.png",
      prompt: "describe",
    });
  });

  it("sends non-object tool input as an input property", async () => {
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

    await expect(tools.voice_to_text.execute?.("raw text", executionOptions)).resolves.toEqual({
      ok: true,
      input: {
        input: "raw text",
      },
    });
    expect(aiRun).toHaveBeenCalledWith("openai/gpt-4o-transcribe", {
      input: "raw text",
    });
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
