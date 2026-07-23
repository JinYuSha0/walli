import { z } from "zod";
import { renderTelegramHtmlFromMarkdown } from "../lib/telegram-format";

type TelegramApiResult = {
  ok: boolean;
  description?: string;
};

export type TelegramApiMethod =
  | "sendMessage"
  | "sendChatAction"
  | "getFile"
  | "sendPhoto"
  | "sendVoice"
  | "readBusinessMessage";

export type TelegramVoiceUpload = {
  voice: Blob;
  filename: string;
};

export type TelegramPhotoUpload = {
  photo: string | Blob;
  filename?: string;
  caption?: string;
};

export type TelegramMessageIdentityInput = {
  chat: {
    id: string | number;
    type?: string;
  };
  from?: {
    id?: string | number;
    first_name?: string;
    last_name?: string;
  };
};

export type TelegramMessageAccessContext = {
  chatId: string;
  chatType: string | undefined;
  userId: string;
  whitelistType: "private" | "group";
  whitelistId: string;
};

const telegramReplyTargetSchema = z
  .object({
    message: z
      .object({
        chat: z
          .object({
            id: z.union([z.string(), z.number()]),
          })
          .loose(),
      })
      .loose()
      .optional(),
  })
  .loose();

const telegramAccessContextUpdateSchema = z
  .object({
    message: z
      .object({
        chat: z
          .object({
            id: z.union([z.string(), z.number()]),
            type: z.string().optional(),
          })
          .loose(),
        from: z
          .object({
            id: z.union([z.string(), z.number()]).optional(),
            first_name: z.string().optional(),
            last_name: z.string().optional(),
          })
          .loose()
          .optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

export const stringifyTelegramId = (id: string | number) => String(id);

export const getTelegramMessageIdentity = (message: TelegramMessageIdentityInput) => {
  const userId =
    message.from?.id === undefined
      ? stringifyTelegramId(message.chat.id)
      : stringifyTelegramId(message.from.id);
  const chatId = stringifyTelegramId(message.chat.id);
  const userName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ");

  return {
    userId,
    chatId,
    userName,
  };
};

export const getTelegramMessageAccessContext = (
  update: unknown,
): TelegramMessageAccessContext | undefined => {
  const result = telegramAccessContextUpdateSchema.safeParse(update);
  const message = result.success ? result.data.message : undefined;

  if (!message) {
    return undefined;
  }

  const { userId, chatId } = getTelegramMessageIdentity(message);
  const chatType = message.chat.type;
  const whitelistType = chatType === "group" || chatType === "supergroup" ? "group" : "private";
  const whitelistId = whitelistType === "group" ? chatId : userId;

  return {
    chatId,
    chatType,
    userId,
    whitelistType,
    whitelistId,
  };
};

export const createTelegramApiUrl = (token: string, method: TelegramApiMethod) =>
  `https://api.telegram.org/bot${token}/${method}`;

export const createTelegramFileUrl = (token: string, filePath: string) =>
  `https://api.telegram.org/file/bot${token}/${filePath}`;

export const postTelegramApi = async (
  token: string,
  method: TelegramApiMethod,
  payload: Record<string, unknown> | FormData,
) => {
  const isFormData = payload instanceof FormData;
  const response = await fetch(createTelegramApiUrl(token, method), {
    method: "POST",
    ...(isFormData
      ? {
          body: payload,
        }
      : {
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        }),
  });
  const result = (await response.json().catch(() => undefined)) as TelegramApiResult | undefined;

  if (!response.ok || result?.ok === false) {
    throw new Error(result?.description ?? `Telegram ${method} request failed`);
  }

  return result;
};

const createDataUriBlob = (value: string) => {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);

  if (!match) {
    return undefined;
  }

  const mimeType = match[1] || "application/octet-stream";
  const body = match[3] ?? "";
  const bytes =
    match[2] === ";base64"
      ? Uint8Array.from(atob(body), (char) => char.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(body));

  return new Blob([bytes], {
    type: mimeType,
  });
};

const getFilenameForMimeType = (mimeType: string, fallback: string) => {
  const extension =
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    }[mimeType] ?? "bin";

  return `${fallback}.${extension}`;
};

export const sendTelegramText = async (token: string, chatId: string | number, text: string) => {
  const fallbackPayload = {
    chat_id: stringifyTelegramId(chatId),
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

export const replyTelegramText = async (token: string, update: unknown, text: string) => {
  const result = telegramReplyTargetSchema.safeParse(update);
  const chatId = result.success ? result.data.message?.chat.id : undefined;

  if (chatId === undefined) {
    return;
  }

  await sendTelegramText(token, chatId, text);
};

export const sendTelegramVoice = async (
  token: string,
  chatId: string | number,
  voice: TelegramVoiceUpload,
) => {
  const body = new FormData();
  body.set("chat_id", stringifyTelegramId(chatId));
  body.set("voice", voice.voice, voice.filename);

  await postTelegramApi(token, "sendVoice", body);
};

export const sendTelegramPhoto = async (
  token: string,
  chatId: string | number,
  image: TelegramPhotoUpload,
) => {
  const sendPhoto = async (caption?: string, parseMode?: "HTML") => {
    const photo = typeof image.photo === "string" ? createDataUriBlob(image.photo) : image.photo;

    if (photo instanceof Blob) {
      const body = new FormData();
      body.set("chat_id", stringifyTelegramId(chatId));
      body.set(
        "photo",
        photo,
        image.filename ?? getFilenameForMimeType(photo.type, "notification"),
      );

      if (caption) {
        body.set("caption", caption.slice(0, 1024));
      }

      if (parseMode) {
        body.set("parse_mode", parseMode);
      }

      await postTelegramApi(token, "sendPhoto", body);
      return;
    }

    await postTelegramApi(token, "sendPhoto", {
      chat_id: stringifyTelegramId(chatId),
      photo: image.photo,
      ...(caption ? { caption: caption.slice(0, 1024) } : {}),
      ...(parseMode ? { parse_mode: parseMode } : {}),
    });
  };

  if (!image.caption) {
    await sendPhoto();
    return;
  }

  try {
    await sendPhoto(renderTelegramHtmlFromMarkdown(image.caption), "HTML");
  } catch {
    await sendPhoto(image.caption);
  }
};
