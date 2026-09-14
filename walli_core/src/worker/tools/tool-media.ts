import { Buffer } from "node:buffer";
import { getAsyncContext } from "../lib/async-context";
import { createImageToTextModelInput } from "@shared/tools/image-to-text";
import { createChatRunnerTools } from "../lib/chat-runner";
import { createGateway, normalizeGatewayModelId, unified } from "../lib/llm";
import { runToolWithContext } from "../lib/tool-runner";
import { getSettings } from "../api/settings";
import { adaptBuiltInToolModelOutput } from "@shared/tools";

const createVoiceToTextModelInput = async (
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  if (typeof input.audio !== "string") return input;
  let audio = input.audio;
  if (audio.startsWith("https://")) {
    const url = new URL(audio);
    const { env, origin } = getAsyncContext();
    // Keep signature validation without fetching this Worker through its public origin.
    const response = url.origin === origin && url.pathname.startsWith("/api/telegram/file/")
      ? await (await import("../api/telegram")).telegramRoute.fetch(new Request(url), env)
      : await fetch(url);
    if (!response.ok) throw new Error(`Speech-to-text audio download failed (${response.status})`);
    audio = Buffer.from(await response.arrayBuffer()).toString("base64");
    if (!audio) throw new Error("Speech-to-text audio is empty");
  } else if (audio.startsWith("data:")) {
    const match = /^data:[^,]*;base64,(.+)$/s.exec(audio);
    if (!match) throw new Error("Speech-to-text audio must be base64 encoded");
    audio = match[1];
  }
  return { ...input, audio };
};

const modelInputAdapters: Record<string, (input: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>> = {
  voice_to_text: createVoiceToTextModelInput,
  image_to_text: createImageToTextModelInput,
};

export const adaptBuiltInToolModelInput = (toolName: string, input: Record<string, unknown>) =>
  modelInputAdapters[toolName]?.(input) ?? input;

export type VoiceOutput = {
  type: "blob";
  voice: Blob;
  filename: string;
};

export type VoiceToTextContext = {
  file: string;
  language?: string;
  prompt?: string;
  temperature?: number;
};

export type ImageToTextContext = {
  file: string[];
  prompt?: string;
};

export type TextToVoiceContext = {
  text: string;
  voice_id?: string;
  output_format?: string;
  temperature?: number;
  timestamp_type?: string;
};

export type BuiltInMediaToolContextMap = {
  voice_to_text: VoiceToTextContext;
  image_to_text: ImageToTextContext;
  text_to_voice: TextToVoiceContext;
};

export type BuiltInMediaToolName = keyof BuiltInMediaToolContextMap;

export const BUILT_IN_MEDIA_TOOL_NAMES = [
  "voice_to_text",
  "image_to_text",
  "text_to_voice",
] satisfies BuiltInMediaToolName[];

const AUTO_TTS_STYLE_PROMPT =
  "[Automatically detect the language of the following text and read it with a natural native accent for that language.]";

export const extractVoiceOutput = async (result: unknown): Promise<VoiceOutput> => {
  if (typeof result === "string") {
    if (result.startsWith("http://") || result.startsWith("https://")) {
      const response = await fetch(result);

      if (!response.ok) {
        throw new Error("Text-to-speech audio URL fetch failed");
      }

      return {
        type: "blob",
        voice: await response.blob(),
        filename: "reply.ogg",
      };
    }

    const base64 = result.startsWith("data:") ? result.split(",", 2)[1] : result;
    return {
      type: "blob",
      voice: new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], {
        type: "audio/ogg",
      }),
      filename: "reply.ogg",
    };
  }

  if (result instanceof Response) {
    return {
      type: "blob",
      voice: await result.blob(),
      filename: "reply.ogg",
    };
  }

  if (result instanceof Blob) {
    return {
      type: "blob",
      voice: result,
      filename: "reply.ogg",
    };
  }

  if (result instanceof ArrayBuffer || result instanceof Uint8Array) {
    const audioData = result instanceof Uint8Array ? new Uint8Array(result) : result;

    return {
      type: "blob",
      voice: new Blob([audioData], {
        type: "audio/ogg",
      }),
      filename: "reply.ogg",
    };
  }

  if (typeof result === "object" && result !== null) {
    const record = result as Record<string, unknown>;
    const audio = record.audio ?? record.file ?? record.data ?? record.result ?? record.output;

    if (audio !== undefined) {
      return extractVoiceOutput(audio);
    }
  }

  throw new Error("Text-to-speech result is not a supported voice payload");
};

export const runBuiltInMediaTool = async <ToolName extends BuiltInMediaToolName>(
  toolName: ToolName,
  taskContext: BuiltInMediaToolContextMap[ToolName],
) => {
  try {
    const settings = await getSettings();
    const toolConfig = [...settings.builtInTools, ...settings.tools].find(
      (configuredTool) => configuredTool.name === toolName,
    );
    const tool = createChatRunnerTools(settings)[toolName];

    if (!tool?.execute) {
      throw new Error(`${toolName} is not available`);
    }

    const gateway = createGateway();
    let input: unknown = taskContext;
    if (toolName === "voice_to_text" && toolConfig?.schema.fields.some((field) => field.name === "audio")
      && !toolConfig.schema.fields.some((field) => field.name === "file")) {
      const { file, ...options } = taskContext as VoiceToTextContext;
      input = { ...options, audio: file };
    }
    const output = await runToolWithContext({
      model: gateway(unified(normalizeGatewayModelId(settings.toolPlannerModel))),
      toolName,
      tool,
      toolConfig,
      taskContext: input,
      toolCallId: `media_${toolName}`,
    });

    return output;
  } catch (error) {
    console.error("[tool-media] Built-in media tool failed", {
      toolName,
      error,
    });
    throw error;
  }
};

export const transcribeVoice = (context: VoiceToTextContext) =>
  runBuiltInMediaTool("voice_to_text", context);

export const describeImage = async (context: ImageToTextContext): Promise<string> => {
  const output = adaptBuiltInToolModelOutput(
    "image_to_text",
    await runBuiltInMediaTool("image_to_text", context),
  );

  return typeof output === "string" ? output : JSON.stringify(output);
};

export const synthesizeVoice = async (
  text: string,
): Promise<VoiceOutput> =>
  extractVoiceOutput(
    await runBuiltInMediaTool("text_to_voice", {
      text: `${AUTO_TTS_STYLE_PROMPT} ${text}`,
      output_format: "opus",
    }),
  );
