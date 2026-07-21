import { Hono } from "hono";
import { dynamicTool, type ModelMessage, type ToolSet } from "ai";
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

type TelegramVoiceOutput = {
  type: "blob";
  voice: Blob;
  filename: string;
};

type TelegramWebhookDeps = {
  sendMessage: (chatId: string, text: string) => Promise<void>;
  sendVoice: (chatId: string, voice: TelegramVoiceOutput) => Promise<void>;
  sendChatAction: (chatId: string, action: "typing" | "record_voice") => Promise<void>;
  getFileUrl: (fileId: string) => Promise<string>;
  markMessageRead: (message: TelegramMessage) => Promise<void>;
  runLlm: (message: TelegramMessage, messages: ModelMessage[]) => Promise<void>;
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

const createTelegramFileSignature = async (secret: string, fileId: string, expires: string) => {
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

  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${fileId}.${expires}`)));
};

const hasValidTelegramFileSignature = async (
  secret: string,
  fileId: string,
  expires: string,
  signature: string,
) => {
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) {
    return false;
  }

  const expectedSignature = await createTelegramFileSignature(secret, fileId, expires);

  return signature === expectedSignature;
};

const createTelegramFileProxyUrl = async (
  origin: string,
  env: Env,
  fileId: string,
  filePath: string,
) => {
  const expires = String(Date.now() + 10 * 60 * 1000);
  const signature = await createTelegramFileSignature(env.API_TOKEN, fileId, expires);
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

const getTelegramFileUrl = async (token: string, fileId: string) =>
  createTelegramFileUrl(token, await getTelegramFilePath(token, fileId));

export const extractVoiceOutput = async (result: unknown): Promise<TelegramVoiceOutput> => {
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

const createTelegramDeliveryTools = async (
  settings: Awaited<ReturnType<typeof getSettings>>,
  env: Env,
  origin: string,
  chatId: string,
  sendMessage: TelegramWebhookDeps["sendMessage"],
  sendVoice: TelegramWebhookDeps["sendVoice"],
  markDelivered: () => void,
): Promise<ToolSet> => {
  const tools = createChatRunnerTools(settings, env, origin);
  const textToVoiceTool = tools.text_to_voice;
  const textReplySchema = z
    .object({
      text: z.string().describe("The text message to send to the Telegram user."),
    })
    .strict();
  const voiceReplySchema = z
    .object({
      text: z.string().describe("The text to synthesize and send as a Telegram voice reply."),
    })
    .strict();
  const deliveryTools: ToolSet = {
    telegram_reply_text: dynamicTool({
      description: "Send a text reply to the current Telegram chat.",
      inputSchema: textReplySchema,
      execute: async (input) => {
        const parsedInput = textReplySchema.parse(input);

        await sendMessage(chatId, parsedInput.text);
        markDelivered();

        return {
          ok: true,
        };
      },
    }),
  };

  if (textToVoiceTool?.execute) {
    deliveryTools.telegram_reply_voice = dynamicTool({
      description:
        "Generate a voice reply from text using the configured text_to_voice tool and send it to the current Telegram chat.",
      inputSchema: voiceReplySchema,
      execute: async (input) => {
        const parsedInput = voiceReplySchema.parse(input);

        const execute = textToVoiceTool.execute as unknown as (
          input: Record<string, unknown>,
          options: unknown,
        ) => Promise<unknown>;
        const voiceResult = await execute(
          {
            text: parsedInput.text,
            response_format: "opus",
          },
          {
            toolCallId: "telegram_text_to_voice",
            messages: [],
            context: undefined,
          },
        );

        await sendVoice(chatId, await extractVoiceOutput(voiceResult));
        markDelivered();

        return {
          ok: true,
        };
      },
    });
  }

  return deliveryTools;
};

const createTelegramDeps = async (env: Env, origin: string): Promise<TelegramWebhookDeps> => {
  const token = await getTelegramBotToken(env.APP_KV, env);

  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  const sendMessage: TelegramWebhookDeps["sendMessage"] = async (chatId, text) => {
    await postTelegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: text.slice(0, 4096),
    });
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
    runLlm: async (message, messages) => {
      const userId =
        message.from?.id === undefined ? stringifyChatId(message.chat.id) : String(message.from.id);
      const userName = [message.from?.first_name, message.from?.last_name]
        .filter(Boolean)
        .join(" ");
      const settings = await getSettings(env.APP_KV);
      let delivered = false;
      const deliveryTools = await createTelegramDeliveryTools(
        settings,
        env,
        origin,
        stringifyChatId(message.chat.id),
        sendMessage,
        sendVoice,
        () => {
          delivered = true;
        },
      );
      await runChatCompletion({
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
        excludeToolNames: ["text_to_voice"],
        extraTools: deliveryTools,
        extraInstructions: [
          "You are replying to a Telegram message.",
          "Use the media tools yourself when the message includes a voice or image HTTPS URL.",
          "For voice messages, call voice_to_text with the provided voice file before answering.",
          "For image messages, call image_to_text with the provided image file before answering.",
          "Send the final answer by calling exactly one Telegram reply tool.",
          "For voice messages, the final reply must use telegram_reply_voice when telegram_reply_voice is available.",
          "For text or image messages, use telegram_reply_voice when the user asks for a voice/audio reply and telegram_reply_voice is available.",
          "For text or image messages without a voice/audio reply request, use telegram_reply_text.",
          "Do not answer with plain model text. Plain model text is not delivered to Telegram.",
        ].join("\n"),
      });

      if (!delivered) {
        throw new Error("Telegram reply tool was not called");
      }
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
  const replyAsVoice = message.voice !== undefined;

  if (!text && !photo && !message.voice) {
    return;
  }

  await Promise.resolve(deps.markMessageRead(message)).catch(() => undefined);

  await deps.sendChatAction(chatId, replyAsVoice ? "record_voice" : "typing");

  try {
    const content: string[] = [
      "Handle this Telegram message and send the final answer with a Telegram reply tool.",
    ];

    if (text) {
      content.push(`Message text: ${text}`);
    }

    if (message.voice) {
      const voiceFile = await deps.getFileUrl(message.voice.file_id);
      content.push(
        [
          "The user sent a voice message.",
          "Use the voice_to_text tool with this file before answering.",
          "Because the original message is voice, the final reply must use telegram_reply_voice when telegram_reply_voice is available.",
          `Voice file: ${voiceFile}`,
        ].join("\n"),
      );
    }

    if (photo) {
      const imageFile = await deps.getFileUrl(photo.file_id);
      content.push(
        [
          "The user sent an image message.",
          "Use the image_to_text tool with this file before answering.",
          `Image file: ${imageFile}`,
        ].join("\n"),
      );
    }

    await deps.runLlm(message, [
      {
        role: "user",
        content: content.join("\n\n"),
      },
    ]);
  } catch {
    await deps.sendMessage(
      chatId,
      replyAsVoice
        ? "Sorry, I couldn't process this audio message."
        : "Sorry, I couldn't process this image message.",
    );
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

    if (!(await hasValidTelegramFileSignature(c.env.API_TOKEN, fileId, expires, signature))) {
      return c.text("Forbidden", 403);
    }

    const token = await getTelegramBotToken(c.env.APP_KV, c.env);

    if (!token) {
      return c.text("Telegram bot token is not configured", 500);
    }

    const telegramFileUrl = await getTelegramFileUrl(token, fileId);
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
