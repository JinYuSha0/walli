import { Hono } from "hono";
import type { ModelMessage, TextPart } from "ai";
import { z } from "zod";
import { createChatRunnerTools, runChatCompletion } from "../lib/chat-runner";
import { getOrCreateClientId, getTelegramBotToken } from "./clients";
import { getSettings } from "./settings";
import type { AppBindings } from "./types";

const telegramChatSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    type: z.string().optional(),
  })
  .loose();

const telegramUserSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
  })
  .loose();

const telegramMessageSchema = z
  .object({
    message_id: z.number(),
    text: z.string().optional(),
    caption: z.string().optional(),
    photo: z
      .array(
        z
          .object({
            file_id: z.string(),
            width: z.number(),
            height: z.number(),
            file_size: z.number().optional(),
          })
          .loose(),
      )
      .optional(),
    voice: z
      .object({
        file_id: z.string(),
        duration: z.number().optional(),
        mime_type: z.string().optional(),
        file_size: z.number().optional(),
      })
      .loose()
      .optional(),
    chat: telegramChatSchema,
    from: telegramUserSchema.optional(),
  })
  .loose();

const telegramUpdateSchema = z
  .object({
    update_id: z.number(),
    message: telegramMessageSchema.optional(),
  })
  .loose();

type TelegramMessage = z.output<typeof telegramMessageSchema>;

type TelegramApiResult = {
  ok: boolean;
  description?: string;
};

type TelegramApiMethod = "sendMessage" | "sendChatAction" | "getFile" | "sendVoice";

type TelegramFileResult = TelegramApiResult & {
  result?: {
    file_path?: string;
  };
};

type TelegramVoiceOutput =
  | {
      type: "url";
      voice: string;
    }
  | {
      type: "blob";
      voice: Blob;
      filename: string;
    };

type TelegramBuiltInMediaToolName = "voice_to_text" | "text_to_voice" | "image_to_text";

type TelegramWebhookDeps = {
  sendMessage: (chatId: string, text: string) => Promise<void>;
  sendVoice: (chatId: string, voice: TelegramVoiceOutput) => Promise<void>;
  sendChatAction: (chatId: string, action: "typing" | "record_voice") => Promise<void>;
  getFileUrl: (fileId: string) => Promise<string>;
  hasBuiltInMediaTool: (toolName: TelegramBuiltInMediaToolName) => Promise<boolean>;
  runBuiltInMediaTool: (
    toolName: TelegramBuiltInMediaToolName,
    input: Record<string, unknown>,
  ) => Promise<unknown | undefined>;
  runLlm: (message: TelegramMessage, messages: ModelMessage[]) => Promise<string>;
};

const stringifyChatId = (chatId: string | number) => String(chatId);

const createTelegramApiUrl = (token: string, method: TelegramApiMethod) =>
  `https://api.telegram.org/bot${token}/${method}`;

const createTelegramFileUrl = (token: string, filePath: string) =>
  `https://api.telegram.org/file/bot${token}/${filePath}`;

const postTelegramApi = async (
  token: string,
  method: TelegramApiMethod,
  payload: Record<string, unknown>,
) => {
  const response = await fetch(createTelegramApiUrl(token, method), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => undefined)) as TelegramApiResult | undefined;

  if (!response.ok || result?.ok === false) {
    throw new Error(result?.description ?? `Telegram ${method} request failed`);
  }
};

const getTelegramFileUrl = async (token: string, fileId: string) => {
  const response = await fetch(createTelegramApiUrl(token, "getFile"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      file_id: fileId,
    }),
  });
  const result = (await response.json().catch(() => undefined)) as TelegramFileResult | undefined;
  const filePath = result?.result?.file_path;

  if (!response.ok || result?.ok === false || !filePath) {
    throw new Error(result?.description ?? "Telegram getFile request failed");
  }

  return createTelegramFileUrl(token, filePath);
};

const extractText = (result: unknown) => {
  if (typeof result === "string") {
    return result;
  }

  if (typeof result !== "object" || result === null) {
    return "";
  }

  const record = result as Record<string, unknown>;

  return [record.text, record.transcript, record.transcription]
    .find((value): value is string => typeof value === "string")
    ?.trim() ?? "";
};

const extractVoiceOutput = async (result: unknown): Promise<TelegramVoiceOutput> => {
  if (typeof result === "string") {
    if (result.startsWith("http://") || result.startsWith("https://")) {
      return {
        type: "url",
        voice: result,
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
    const audio = record.audio ?? record.file ?? record.data;

    if (audio !== undefined) {
      return extractVoiceOutput(audio);
    }
  }

  throw new Error("Text-to-speech result is not a supported voice payload");
};

const sendTelegramVoice = async (
  token: string,
  chatId: string,
  voice: TelegramVoiceOutput,
) => {
  if (voice.type === "url") {
    await postTelegramApi(token, "sendVoice", {
      chat_id: chatId,
      voice: voice.voice,
    });
    return;
  }

  const body = new FormData();
  body.set("chat_id", chatId);
  body.set("voice", voice.voice, voice.filename);

  const response = await fetch(createTelegramApiUrl(token, "sendVoice"), {
    method: "POST",
    body,
  });
  const result = (await response.json().catch(() => undefined)) as TelegramApiResult | undefined;

  if (!response.ok || result?.ok === false) {
    throw new Error(result?.description ?? "Telegram sendVoice request failed");
  }
};

const createBuiltInMediaTools = async (env: Env, origin: string) => {
  const settings = await getSettings(env.APP_KV);

  return createChatRunnerTools(settings, env, origin);
};

const createTelegramDeps = async (env: Env, origin: string): Promise<TelegramWebhookDeps> => {
  const token = await getTelegramBotToken(env.APP_KV, env);

  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  return {
    sendMessage: async (chatId, text) => {
      await postTelegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: text.slice(0, 4096),
      });
    },
    sendVoice: async (chatId, voice) => {
      await sendTelegramVoice(token, chatId, voice);
    },
    sendChatAction: async (chatId, action) => {
      await postTelegramApi(token, "sendChatAction", {
        chat_id: chatId,
        action,
      });
    },
    getFileUrl: async (fileId) => getTelegramFileUrl(token, fileId),
    hasBuiltInMediaTool: async (toolName) => {
      const tools = await createBuiltInMediaTools(env, origin);

      return Boolean(tools[toolName]?.execute);
    },
    runBuiltInMediaTool: async (toolName, input) => {
      const tools = await createBuiltInMediaTools(env, origin);
      const tool = tools[toolName];

      if (!tool?.execute) {
        return undefined;
      }

      const execute = tool.execute as unknown as (
        input: Record<string, unknown>,
        options: unknown,
      ) => Promise<unknown>;

      return execute(input, {
        toolCallId: `telegram_${toolName}`,
        messages: [],
        context: undefined,
      });
    },
    runLlm: async (message, messages) => {
      const userId =
        message.from?.id === undefined ? stringifyChatId(message.chat.id) : String(message.from.id);
      const userName = [message.from?.first_name, message.from?.last_name]
        .filter(Boolean)
        .join(" ");
      const result = await runChatCompletion({
        env,
        origin,
        userInfo: {
          userId,
          name: userName || message.from?.username || userId,
          telegram: {
            chatId: stringifyChatId(message.chat.id),
            username: message.from?.username,
            languageCode: message.from?.language_code,
          },
        },
        messages,
      });

      return result.text.trim() || "Done.";
    },
  };
};

export const handleTelegramWebhookUpdate = async (update: unknown, deps: TelegramWebhookDeps) => {
  const result = telegramUpdateSchema.safeParse(update);

  if (!result.success) {
    throw new Error("Invalid Telegram update");
  }

  const message = result.data.message;

  if (!message) {
    return;
  }

  const chatId = stringifyChatId(message.chat.id);
  const text = message.text?.trim() ?? message.caption?.trim() ?? "";
  const photo = message.photo?.slice().sort((left, right) => {
    const leftSize = left.file_size ?? left.width * left.height;
    const rightSize = right.file_size ?? right.width * right.height;

    return rightSize - leftSize;
  })[0];
  const content: TextPart[] = [];
  const replyAsVoice = message.voice !== undefined;

  if (!text && !photo && !message.voice) {
    return;
  }

  await deps.sendChatAction(chatId, replyAsVoice ? "record_voice" : "typing");

  if (message.voice) {
    if (!(await deps.hasBuiltInMediaTool("voice_to_text"))) {
      await deps.sendMessage(chatId, "Audio messages are not supported.");
      return;
    }

    if (!(await deps.hasBuiltInMediaTool("text_to_voice"))) {
      await deps.sendMessage(chatId, "Audio replies are not supported.");
      return;
    }

    const voiceUrl = await deps.getFileUrl(message.voice.file_id);
    const transcript = extractText(
      await deps.runBuiltInMediaTool("voice_to_text", {
        file: voiceUrl,
        ...(message.voice.mime_type
          ? {
              mime_type: message.voice.mime_type,
            }
          : {}),
      }),
    );

    if (!transcript) {
      throw new Error("Voice transcription returned empty text");
    }

    content.push({
      type: "text",
      text: transcript,
    });
  } else {
    content.push({
      type: "text",
      text: text || "Please respond to the attached image.",
    });
  }

  if (photo) {
    if (!(await deps.hasBuiltInMediaTool("image_to_text"))) {
      await deps.sendMessage(chatId, "Image messages are not supported.");
      return;
    }

    const imageUrl = await deps.getFileUrl(photo.file_id);
    const imageText = extractText(
      await deps.runBuiltInMediaTool("image_to_text", {
        file: imageUrl,
      }),
    );

    if (!imageText) {
      throw new Error("Image recognition returned empty text");
    }

    content.push({
      type: "text",
      text: `Image content: ${imageText}`,
    });
  }

  const replyText = await deps.runLlm(message, [
    {
      role: "user",
      content,
    },
  ]);

  if (!replyAsVoice) {
    await deps.sendMessage(chatId, replyText);
    return;
  }

  try {
    const voiceResult = await deps.runBuiltInMediaTool("text_to_voice", {
      text: replyText,
      voice: "alloy",
      response_format: "opus",
    });

    await deps.sendVoice(chatId, await extractVoiceOutput(voiceResult));
  } catch (error) {
    console.error(error);
    await deps.sendMessage(chatId, replyText);
  }
};

const hasValidTelegramWebhookSecret = (request: Request, secret: string) => {
  return request.headers.get("x-telegram-bot-api-secret-token") === secret;
};

export const telegramRoute = new Hono<AppBindings>().post("/api/telegram/webhook", async (c) => {
  const webhookSecret = await getOrCreateClientId(c.env.APP_KV, "telegram");

  if (!hasValidTelegramWebhookSecret(c.req.raw, webhookSecret)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!(await getTelegramBotToken(c.env.APP_KV, c.env))) {
    return c.json(
      {
        error: "Telegram bot token is not configured",
      },
      500,
    );
  }

  const update = await c.req.json().catch(() => null);
  const origin = new URL(c.req.url).origin;

  c.executionCtx.waitUntil(
    createTelegramDeps(c.env, origin)
      .then((deps) => handleTelegramWebhookUpdate(update, deps))
      .catch((error) => {
      console.error(error);
      }),
  );

  return c.json({ ok: true });
});
