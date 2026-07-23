import { getTelegramBotToken } from "@worker/api/clients";
import {
  sendTelegramPhoto,
  sendTelegramText,
  sendTelegramVoice,
  type TelegramPhotoUpload,
  type TelegramVoiceUpload,
} from "./tg";
import type { UserNotificationChannel } from "../durable-objects/user/types";

const sendNotificationTelegramText = async (env: Env, chatId: string, text: string) => {
  await sendTelegramText(await getTelegramToken(env), chatId, text);
};

const getTelegramToken = async (env: Env) => {
  const token = await getTelegramBotToken(env.APP_KV, env);

  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  return token;
};

const sendNotificationTelegramVoice = async (
  env: Env,
  chatId: string,
  voice: TelegramVoiceUpload,
) => {
  await sendTelegramVoice(await getTelegramToken(env), chatId, voice);
};

const sendNotificationTelegramImage = async (
  env: Env,
  chatId: string,
  image: TelegramPhotoUpload,
) => {
  await sendTelegramPhoto(await getTelegramToken(env), chatId, image);
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

export const sendNotificationVoice = async (
  env: Env,
  notificationChannel: UserNotificationChannel,
  voice: TelegramVoiceUpload,
) => {
  switch (notificationChannel.type) {
    case "telegram":
      await sendNotificationTelegramVoice(env, notificationChannel.userId, voice);
      return;
    case "web":
      throw new Error("TODO: Web notification delivery is not implemented");
    case "react-native":
      throw new Error("TODO: React Native notification delivery is not implemented");
    case "flutter":
      throw new Error("TODO: Flutter notification delivery is not implemented");
  }
};

export const sendNotificationImage = async (
  env: Env,
  notificationChannel: UserNotificationChannel,
  image: TelegramPhotoUpload,
) => {
  switch (notificationChannel.type) {
    case "telegram":
      await sendNotificationTelegramImage(env, notificationChannel.userId, image);
      return;
    case "web":
      throw new Error("TODO: Web notification delivery is not implemented");
    case "react-native":
      throw new Error("TODO: React Native notification delivery is not implemented");
    case "flutter":
      throw new Error("TODO: Flutter notification delivery is not implemented");
  }
};
