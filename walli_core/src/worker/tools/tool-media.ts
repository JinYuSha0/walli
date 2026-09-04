import { createChatRunnerTools } from "../lib/chat-runner";
import { createGateway, normalizeGatewayModelId, unified } from "../lib/llm";
import { runToolWithContext } from "../lib/tool-runner";
import { getSettings } from "../api/settings";
import { adaptBuiltInToolModelOutput } from "@shared/tools";

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
    const output = await runToolWithContext({
      model: gateway(unified(normalizeGatewayModelId(settings.toolPlannerModel))),
      toolName,
      tool,
      toolConfig,
      taskContext,
      toolCallId: `media_${toolName}`,
    });

    return output;
  } catch (error) {
    console.error("[tool-media] Built-in media tool failed", {
      toolName,
      context: taskContext,
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
