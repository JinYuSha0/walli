import { Hono } from "hono";
import { Output, type ModelMessage } from "ai";
import { z } from "zod";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { runChatCompletion } from "@worker/lib/chat-runner";
import { renderTelegramHtmlFromMarkdown } from "@worker/lib/telegram-format";
import type { Database } from "@worker/db/client";
import { telegramWhitelistUser } from "@worker/db/schema";
import {
  getClientBasicSettings,
  getOrCreateClientId,
  getTelegramBotToken,
  getTelegramSettings,
} from "./clients";
import { getSettings } from "./settings";
import type { AppBindings } from "./types";
import { requireAdmin } from "./helper/middleware";
import {
  telegramWhitelistCreateSchema,
  telegramWhitelistListResponseSchema,
  telegramWhitelistTypeSchema,
  type TelegramWhitelistType,
} from "@shared/client";
import { parseResponse } from "./helper/validation";
import {
  BUILT_IN_MEDIA_TOOL_NAMES,
  describeImage,
  synthesizeVoice,
  transcribeVoice,
  type ImageToTextContext,
  type VoiceOutput,
  type VoiceToTextContext,
} from "@worker/tools/tool-media";

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

const telegramPhotoSchema = z
  .object({
    file_id: z.string(),
    width: z.number(),
    height: z.number(),
    file_size: z.number().optional(),
  })
  .loose();

const telegramMessageSchema = z
  .object({
    message_id: z.number(),
    business_connection_id: z.string().optional(),
    text: z.string().optional(),
    caption: z.string().optional(),
    photo: z.array(telegramPhotoSchema).optional(),
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
  describeImage?: (context: ImageToTextContext) => Promise<string>;
  synthesizeVoice?: (text: string) => Promise<TelegramVoiceOutput>;
  runLlm: (message: TelegramMessage, messages: ModelMessage[]) => Promise<TelegramReply>;
};

const stringifyChatId = (chatId: string | number) => String(chatId);

const isEmptyTelegramMessage = (message: TelegramMessage) => {
  const record = message as Record<string, unknown>;

  return Object.keys(record).every((key) => ["message_id", "chat", "from"].includes(key));
};

const selectBestTelegramPhoto = (photos: TelegramMessage["photo"]) => {
  if (!photos || photos.length === 0) {
    return undefined;
  }

  return photos.reduce((bestPhoto, photo) => {
    const bestScore = bestPhoto.file_size ?? bestPhoto.width * bestPhoto.height;
    const score = photo.file_size ?? photo.width * photo.height;

    return score > bestScore ? photo : bestPhoto;
  });
};

const getImagePrompt = (text: string) => {
  const basePrompt = "Describe this Telegram image and extract any visible text.";

  return text ? `${basePrompt} Additional message text/caption: ${text}` : basePrompt;
};

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
      const basicSettings = await getClientBasicSettings(env.APP_KV, "telegram");
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
          basicSettings.additionalSystemPrompt,
          "Reply to the Telegram user using the provided message text and media analysis.",
          'Return JSON structured output with {"type":"text"|"voice","text":"..."} after using any needed tools.',
          "The text field must be the human-readable reply text, never an audio URL or generated media payload.",
          "Follow the preferred reply type unless the user explicitly asks otherwise; image replies are unsupported, so explain that in text.",
        ]
          .map((instruction) => instruction.trim())
          .filter((instruction) => instruction.length > 0)
          .join("\n\n"),
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
  const photo = selectBestTelegramPhoto(message.photo);
  const canHandleMessage = Boolean(message.text?.trim() || photo || message.voice);

  if (!canHandleMessage && isEmptyTelegramMessage(message)) {
    return;
  }

  await Promise.resolve(deps.markMessageRead(message)).catch(() => undefined);

  if (!canHandleMessage) {
    await deps.sendMessage(chatId, "Sorry, this Telegram media type is not supported yet.");
    return;
  }

  await deps.sendChatAction(chatId, "typing");

  try {
    const content: string[] = [];

    if (message.text?.trim()) {
      content.push(`Message text: ${text}`);
    } else if (message.caption?.trim()) {
      content.push(`Message caption/additional info: ${text}`);
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
      const imageDescription = await deps.describeImage?.({
        file: [imageFile],
        prompt: getImagePrompt(text),
      });

      if (imageDescription === undefined) {
        throw new Error("Image recognition is not available");
      }

      content.push(
        ["The user sent an image message.", `Image recognition result: ${imageDescription}`].join(
          "\n",
        ),
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

const replyTelegramText = async (token: string, update: unknown, text: string) => {
  const result = telegramUpdateSchema.safeParse(update);

  if (!result.success) {
    return;
  }

  const chatId = result.data.message?.chat.id;

  if (chatId === undefined) {
    return;
  }

  const fallbackPayload = {
    chat_id: stringifyChatId(chatId),
    text,
  };

  try {
    await postTelegramApi(token, "sendMessage", {
      ...fallbackPayload,
      text: renderTelegramHtmlFromMarkdown(text),
      parse_mode: "HTML",
    });
  } catch {
    await postTelegramApi(token, "sendMessage", fallbackPayload);
  }
};

const getTelegramMessageAccessContext = (update: unknown) => {
  const result = telegramUpdateSchema.safeParse(update);

  if (!result.success || !result.data.message) {
    return undefined;
  }

  const { message } = result.data;
  const userId =
    message.from?.id === undefined ? stringifyChatId(message.chat.id) : String(message.from.id);
  const chatId = stringifyChatId(message.chat.id);
  const chatType = message.chat.type;
  const whitelistType: TelegramWhitelistType =
    chatType === "group" || chatType === "supergroup" ? "group" : "private";
  const whitelistId = whitelistType === "group" ? chatId : userId;

  return {
    chatId,
    chatType,
    userId,
    whitelistType,
    whitelistId,
  };
};

const telegramWhitelistQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
  type: telegramWhitelistTypeSchema.optional(),
});

const listTelegramWhitelistEntries = async (
  db: Database,
  query: z.output<typeof telegramWhitelistQuerySchema>,
) => {
  const offset = (query.page - 1) * query.pageSize;
  const where = query.type ? eq(telegramWhitelistUser.type, query.type) : undefined;
  const totalQuery = db.select({ total: count() }).from(telegramWhitelistUser);
  const itemsQuery = db
    .select({
      type: telegramWhitelistUser.type,
      id: telegramWhitelistUser.id,
      remark: telegramWhitelistUser.remark,
      createdAt: telegramWhitelistUser.createdAt,
    })
    .from(telegramWhitelistUser);
  const [countResult, items] = await Promise.all([
    (where ? totalQuery.where(where) : totalQuery).get(),
    (where ? itemsQuery.where(where) : itemsQuery)
      .orderBy(
        desc(telegramWhitelistUser.createdAt),
        asc(telegramWhitelistUser.type),
        asc(telegramWhitelistUser.id),
      )
      .limit(query.pageSize)
      .offset(offset)
      .all(),
  ]);

  return parseResponse(telegramWhitelistListResponseSchema, {
    items: items.map((item) => ({
      ...item,
      remark: item.remark ?? "",
    })),
    total: countResult?.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  });
};

const hasTelegramWhitelistEntry = async (db: Database, type: TelegramWhitelistType, id: string) => {
  const result = await db
    .select({ id: telegramWhitelistUser.id })
    .from(telegramWhitelistUser)
    .where(and(eq(telegramWhitelistUser.type, type), eq(telegramWhitelistUser.id, id)))
    .get();

  return Boolean(result);
};

export const telegramRoute = new Hono<AppBindings>()
  .use("/api/admin/telegram/whitelist", requireAdmin)
  .use("/api/admin/telegram/whitelist/*", requireAdmin)
  .get("/api/admin/telegram/whitelist", async (c) => {
    const query = telegramWhitelistQuerySchema.parse({
      page: c.req.query("page"),
      pageSize: c.req.query("pageSize"),
      type: c.req.query("type") || undefined,
    });

    return c.json(await listTelegramWhitelistEntries(c.get("db"), query));
  })
  .post("/api/admin/telegram/whitelist", async (c) => {
    const body = await c.req.json().catch(() => null);
    const result = telegramWhitelistCreateSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        {
          error: "Invalid body",
          issues: z.treeifyError(result.error),
        },
        400,
      );
    }

    const entry = {
      ...result.data,
      remark: result.data.remark?.trim() ?? "",
      createdAt: Date.now(),
    };

    await c.get("db").insert(telegramWhitelistUser).values(entry).onConflictDoNothing().run();

    return c.json(entry, 201);
  })
  .delete("/api/admin/telegram/whitelist/:type/:id", async (c) => {
    const typeResult = telegramWhitelistTypeSchema.safeParse(c.req.param("type"));
    const idResult = telegramWhitelistCreateSchema.shape.id.safeParse(c.req.param("id"));

    if (!typeResult.success || !idResult.success) {
      return c.json(
        {
          error: "Invalid whitelist entry",
          issues: {
            type: typeResult.success ? undefined : z.treeifyError(typeResult.error),
            id: idResult.success ? undefined : z.treeifyError(idResult.error),
          },
        },
        400,
      );
    }

    await c
      .get("db")
      .delete(telegramWhitelistUser)
      .where(
        and(
          eq(telegramWhitelistUser.type, typeResult.data),
          eq(telegramWhitelistUser.id, idResult.data),
        ),
      )
      .run();

    return c.json({ ok: true });
  })
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

    const token = await getTelegramBotToken(c.env.APP_KV, c.env);

    if (!token) {
      return c.json(
        {
          error: "Telegram bot token is not configured",
        },
        500,
      );
    }

    const update = await c.req.json().catch(() => null);
    const basicSettings = await getClientBasicSettings(c.env.APP_KV, "telegram");

    if (!basicSettings.enabled) {
      await replyTelegramText(token, update, "Not enabled");

      return c.json({ ok: true });
    }

    const accessContext = getTelegramMessageAccessContext(update);

    const telegramSettings = await getTelegramSettings(c.env.APP_KV);

    if (telegramSettings.accessPolicy === "whitelist") {
      const whitelistType = accessContext?.whitelistType;
      const whitelistId = accessContext?.whitelistId;

      if (
        !whitelistType ||
        !whitelistId ||
        !(await hasTelegramWhitelistEntry(c.get("db"), whitelistType, whitelistId))
      ) {
        await replyTelegramText(
          token,
          update,
          `Please contact the administrator to add ${whitelistType ?? "private"} ID \`${whitelistId ?? "unknown"}\` to the whitelist.`,
        );

        return c.json({ ok: true });
      }
    }

    const origin = new URL(c.req.url).origin;

    c.executionCtx.waitUntil(
      createTelegramDeps(c.env, origin)
        .then((deps) => handleTelegramWebhookUpdate(update, deps))
        .catch(() => undefined),
    );

    return c.json({ ok: true });
  });
