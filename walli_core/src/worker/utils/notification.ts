import { getTelegramBotToken } from "@worker/api/clients";
import { sendTelegramText } from "./tg";
import type { UserNotificationChannel } from "../durable-objects/user/types";

const sendNotificationTelegramText = async (env: Env, chatId: string, text: string) => {
  const token = await getTelegramBotToken(env.APP_KV, env);

  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  await sendTelegramText(token, chatId, text);
};

export const sendNotificationText = async (
  env: Env,
  notificationChannel: UserNotificationChannel,
  text: string,
) => {
  switch (notificationChannel.type) {
    case "telegram":
      await sendNotificationTelegramText(env, notificationChannel.userId, text);
      return;
    case "web":
      // TODO: Implement web push or in-app notification delivery.
      throw new Error("TODO: Web notification delivery is not implemented");
    case "react-native":
      // TODO: Implement React Native push notification delivery.
      throw new Error("TODO: React Native notification delivery is not implemented");
    case "flutter":
      // TODO: Implement Flutter push notification delivery.
      throw new Error("TODO: Flutter notification delivery is not implemented");
  }
};
