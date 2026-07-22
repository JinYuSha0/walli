import { Hono } from "hono";
import { Output, type ModelMessage } from "ai";
import { z } from "zod";
import { runChatCompletion } from "../lib/chat-runner";
import { renderTelegramHtmlFromMarkdown } from "../lib/telegram-format";
import { getOrCreateClientId, getTelegramBotToken } from "./clients";
import { getSettings } from "./settings";
import type { AppBindings } from "./types";
import {
  BUILT_IN_MEDIA_TOOL_NAMES,
  describeImage,
  synthesizeVoice,
  transcribeVoice,
  type ImageToTextContext,
  type VoiceOutput,
  type VoiceToTextContext,
} from "../tools/media-tools";

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
    business_connection_id: z.string().optional(),
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

type TelegramApiMethod =
  "sendMessage" | "sendChatAction" | "getFile" | "sendVoice" | "readBusinessMessage";

type TelegramFileResult = TelegramApiResult & {
  result?: {
    file_path?: string;
  };
};

type TelegramVoiceOutput = VoiceOutput;

const telegramReplySchema = z
  .object({
    type: z.enum(["text", "voice"]),
    text: z.string().trim().min(1),
  })
  .strip();

type TelegramReply = z.output<typeof telegramReplySchema>;

type TelegramWebhookDeps = {
  sendMessage: (chatId: string, text: string) => Promise<void>;
  sendVoice: (chatId: string, voice: TelegramVoiceOutput) => Promise<void>;
  sendChatAction: (chatId: string, action: "typing" | "record_voice") => Promise<void>;
  getFileUrl: (fileId: string) => Promise<string>;
  markMessageRead: (message: TelegramMessage) => Promise<void>;
  transcribeVoice?: (context: VoiceToTextContext) => Promise<unknown>;
  describeImage?: (context: ImageToTextContext) => Promise<unknown>;
  synthesizeVoice?: (text: string) => Promise<TelegramVoiceOutput>;
  runLlm: (message: TelegramMessage, messages: ModelMessage[]) => Promise<TelegramReply>;
};

const stringifyChatId = (chatId: string | number) => String(chatId);

const createTelegramApiUrl = (token: string, method: TelegramApiMethod) =>
  `https://api.telegram.org/bot${token}/${method}`;

const createTelegramFileUrl = (token: string, filePath: string) =>
  `https://api.telegram.org/file/bot${token}/${filePath}`;

const inferTelegramFileContentType = (filePath: string) => {
  const normalizedPath = filePath.toLowerCase();
  const match = [
    [[".oga", ".ogg"], "audio/ogg"],
    [[".opus"], "audio/opus"],
    [[".mp3"], "audio/mpeg"],
    [[".m4a", ".mp4"], "audio/mp4"],
    [[".wav"], "audio/wav"],
    [[".webm"], "audio/webm"],
    [[".jpg", ".jpeg"], "image/jpeg"],
    [[".png"], "image/png"],
    [[".webp"], "image/webp"],
  ].find(([extensions]) =>
    (extensions as string[]).some((extension) => normalizedPath.endsWith(extension)),
  );

  return (match?.[1] as string | undefined) ?? "application/octet-stream";
};

const bytesToHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const createTelegramFileSignature = async (
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

  return bytesToHex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${fileId}.${expires}.${filePath}`)),
  );
};

const hasValidTelegramFileSignature = async (
  secret: string,
  fileId: string,
  expires: string,
  filePath: string,
  signature: string,
) => {
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) {
    return false;
  }

  const expectedSignature = await createTelegramFileSignature(secret, fileId, expires, filePath);

  return signature === expectedSignature;
};

const createTelegramFileProxyUrl = async (
  origin: string,
  env: Env,
  fileId: string,
  filePath: string,
) => {
  const expires = String(Date.now() + 10 * 60 * 1000);
  const signature = await createTelegramFileSignature(env.API_TOKEN, fileId, expires, filePath);
  const url = new URL(`/api/telegram/file/${filePath}`, origin);

  url.searchParams.set("fileId", fileId);
  url.searchParams.set("expires", expires);
  url.searchParams.set("signature", signature);

  return url.toString();
};

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

const getTelegramFilePath = async (token: string, fileId: string) => {
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

  return filePath;
};

const sendTelegramVoice = async (token: string, chatId: string, voice: TelegramVoiceOutput) => {
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

const createTelegramDeps = async (env: Env, origin: string): Promise<TelegramWebhookDeps> => {
  const token = await getTelegramBotToken(env.APP_KV, env);

  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  const sendMessage: TelegramWebhookDeps["sendMessage"] = async (chatId, text) => {
    const fallbackPayload = {
      chat_id: chatId,
      text: text.slice(0, 4096),
    };

    try {
      await postTelegramApi(token, "sendMessage", {
        ...fallbackPayload,
        text: renderTelegramHtmlFromMarkdown(text).slice(0, 4096),
        parse_mode: "HTML",
        link_preview_options: {
          is_disabled: true,
        },
      });
    } catch {
      await postTelegramApi(token, "sendMessage", fallbackPayload);
    }
  };
  const sendVoice: TelegramWebhookDeps["sendVoice"] = async (chatId, voice) => {
    await sendTelegramVoice(token, chatId, voice);
  };

  return {
    sendMessage,
    sendVoice,
    sendChatAction: async (chatId, action) => {
      await postTelegramApi(token, "sendChatAction", {
        chat_id: chatId,
        action,
      });
    },
    getFileUrl: async (fileId) =>
      createTelegramFileProxyUrl(origin, env, fileId, await getTelegramFilePath(token, fileId)),
    markMessageRead: async (message) => {
      if (!message.business_connection_id || typeof message.chat.id !== "number") {
        return;
      }

      await postTelegramApi(token, "readBusinessMessage", {
        business_connection_id: message.business_connection_id,
        chat_id: message.chat.id,
        message_id: message.message_id,
      });
    },
    transcribeVoice: (context) => transcribeVoice(env, origin, context),
    describeImage: (context) => describeImage(env, origin, context),
    synthesizeVoice: (text) => synthesizeVoice(env, origin, text),
    runLlm: async (message, messages) => {
      const userId =
        message.from?.id === undefined ? stringifyChatId(message.chat.id) : String(message.from.id);
      const userName = [message.from?.first_name, message.from?.last_name]
        .filter(Boolean)
        .join(" ");
      const settings = await getSettings(env.APP_KV);
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
        settings,
        excludeToolNames: [...BUILT_IN_MEDIA_TOOL_NAMES],
        output: Output.object({
          schema: telegramReplySchema,
          name: "telegram_reply",
          description: "Telegram reply type and final reply content.",
        }),
        extraInstructions: [
          "Reply to the Telegram user using the provided message text and media analysis.",
          'Return JSON structured output with {"type":"text"|"voice","text":"..."} after using any needed tools.',
          "The text field must be the human-readable reply text, never an audio URL or generated media payload.",
          "Follow the preferred reply type unless the user explicitly asks otherwise; image replies are unsupported, so explain that in text.",
        ].join("\n"),
      });

      return result.output;
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

  if (!text && !photo && !message.voice) {
    return;
  }

  await Promise.resolve(deps.markMessageRead(message)).catch(() => undefined);

  await deps.sendChatAction(chatId, "typing");

  try {
    const content: string[] = [];

    if (text) {
      content.push(`Message text: ${text}`);
    }

    if (message.voice) {
      const voiceFile = await deps.getFileUrl(message.voice.file_id);
      const transcription = await deps.transcribeVoice?.({
        file: voiceFile,
      });

      if (transcription === undefined) {
        throw new Error("Voice transcription is not available");
      }

      content.push(
        [
          "The user sent a voice message.",
          "Preferred reply type: voice, unless the user explicitly asks for text.",
          `Voice transcription result: ${JSON.stringify(transcription)}`,
        ].join("\n"),
      );
    }

    if (photo) {
      const imageFile = await deps.getFileUrl(photo.file_id);
      const imagePrompt = text
        ? `Describe this Telegram image and extract any visible text. Caption: ${text}`
        : "Describe this Telegram image and extract any visible text.";
      const imageDescription = await deps.describeImage?.({
        file: imageFile,
        prompt: imagePrompt,
      });

      if (imageDescription === undefined) {
        throw new Error("Image recognition is not available");
      }

      content.push(
        [
          "The user sent an image message.",
          `Image recognition result: ${JSON.stringify(imageDescription)}`,
        ].join("\n"),
      );
    }

    const reply = await deps.runLlm(message, [
      {
        role: "user",
        content: content.join("\n\n"),
      },
    ]);

    if (reply.type === "voice") {
      await deps.sendChatAction(chatId, "record_voice");
      const voice = await deps.synthesizeVoice?.(reply.text);

      if (!voice) {
        await deps.sendMessage(chatId, "Sorry, audio replies are not supported right now.");
        return;
      }

      await deps.sendVoice(chatId, voice);
      return;
    }

    await deps.sendMessage(chatId, reply.text);
  } catch (error) {
    console.error(error);
    let fallbackText = "Sorry, I couldn't process this message.";

    if (message.voice) {
      fallbackText = "Sorry, I couldn't process this audio message.";
    } else if (photo) {
      fallbackText = "Sorry, I couldn't process this image message.";
    }

    await deps.sendMessage(chatId, fallbackText);
  }
};

const hasValidTelegramWebhookSecret = (request: Request, secret: string) => {
  return request.headers.get("x-telegram-bot-api-secret-token") === secret;
};

export const telegramRoute = new Hono<AppBindings>()
  .get("/api/telegram/file/*", async (c) => {
    const fileId = c.req.query("fileId");
    const expires = c.req.query("expires");
    const signature = c.req.query("signature");
    const filePath = c.req.path.replace(/^\/api\/telegram\/file\//, "");

    if (!fileId || !expires || !signature) {
      return c.text("Missing file signature", 400);
    }

    if (
      !(await hasValidTelegramFileSignature(c.env.API_TOKEN, fileId, expires, filePath, signature))
    ) {
      return c.text("Forbidden", 403);
    }

    const token = await getTelegramBotToken(c.env.APP_KV, c.env);

    if (!token) {
      return c.text("Telegram bot token is not configured", 500);
    }

    const telegramFileUrl = createTelegramFileUrl(token, filePath);
    const response = await fetch(telegramFileUrl);
    const forcedContentType = inferTelegramFileContentType(filePath);

    if (!response.ok) {
      return c.text("Telegram file fetch failed", 502);
    }

    const headers = new Headers({
      "cache-control": "no-store",
      "content-type": forcedContentType,
    });
    const contentLength = response.headers.get("content-length");

    if (contentLength) {
      headers.set("content-length", contentLength);
    }

    return new Response(response.body, {
      status: 200,
      headers,
    });
  })
  .post("/api/telegram/webhook", async (c) => {
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
        .catch(() => undefined),
    );

    return c.json({ ok: true });
  });
