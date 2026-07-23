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
  | "sendVoice"
  | "readBusinessMessage";

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
