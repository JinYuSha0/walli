import { generateText, isStepCount } from "ai";
import { createChatRunnerTools } from "../lib/chat-runner";
import { createLooseToolInputSchema } from "../lib/chat-tools";
import { createGatewayFromEnv, normalizeGatewayModelId, unified } from "../lib/llm";
import { getSettings } from "../api/settings";

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
  file: string;
  prompt?: string;
};

export type TextToVoiceContext = {
  text: string;
  voice?: string;
  response_format?: string;
  speed?: number;
};

export type BuiltInMediaToolContextMap = {
  voice_to_text: VoiceToTextContext;
  image_to_text: ImageToTextContext;
  text_to_voice: TextToVoiceContext;
};

export type BuiltInMediaToolName = keyof BuiltInMediaToolContextMap;

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
  env: Env,
  origin: string,
  toolName: ToolName,
  taskContext: BuiltInMediaToolContextMap[ToolName],
) => {
  try {
    const settings = await getSettings(env.APP_KV);
    const toolConfig = [...settings.builtInTools, ...settings.tools].find(
      (configuredTool) => configuredTool.name === toolName,
    );
    const tool = createChatRunnerTools(settings, env, origin)[toolName];

    if (!tool?.execute) {
      throw new Error(`${toolName} is not available`);
    }

    // Fast path: callers like Telegram usually already provide the exact built-in tool input.
    // Executing directly avoids an extra planner-model request before the actual media tool call.
    if (toolConfig) {
      const directInput = createLooseToolInputSchema(toolConfig).safeParse(taskContext);

      if (directInput.success) {
        const execute = tool.execute as unknown as (
          input: Record<string, unknown>,
          options: unknown,
        ) => Promise<unknown>;

        return await execute(directInput.data, {
          toolCallId: `media_${toolName}`,
          messages: [],
          context: undefined,
        });
      }
    }

    // Fallback for fuzzy task context: this intentionally uses a planner LLM to translate the
    // context into one tool invocation, so a media request may involve planner + media LLM calls.
    const result = await generateText({
      model: createGatewayFromEnv(env)(
        unified(normalizeGatewayModelId(settings.toolPlannerModel)),
      ),
      instructions: [
        `Call the ${toolName} tool exactly once.`,
        "Infer the tool input from the task context and the tool schema.",
        "Do not answer directly.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: JSON.stringify(taskContext),
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
  } catch (error) {
    console.error("[media-tools] Built-in media tool failed", {
      toolName,
      contextKeys: Object.keys(taskContext),
      error,
    });
    throw error;
  }
};

export const transcribeVoice = (env: Env, origin: string, context: VoiceToTextContext) =>
  runBuiltInMediaTool(env, origin, "voice_to_text", context);

export const describeImage = (env: Env, origin: string, context: ImageToTextContext) =>
  runBuiltInMediaTool(env, origin, "image_to_text", context);

export const synthesizeVoice = async (
  env: Env,
  origin: string,
  text: string,
): Promise<VoiceOutput> =>
  extractVoiceOutput(
    await runBuiltInMediaTool(env, origin, "text_to_voice", {
      text,
      response_format: "opus",
    }),
  );
