import { getTelegramBotToken } from "@worker/api/clients";
import {
  sendTelegramPhoto,
  sendTelegramText,
  sendTelegramVoice,
  type TelegramPhotoUpload,
  type TelegramVoiceUpload,
} from "../utils/tg";
import type { UserNotificationChannel } from "../durable-objects/user/types";

const sendNotificationTelegramText = async (chatId: string, text: string, clientId: string) => {
  await sendTelegramText(await getTelegramToken(clientId), chatId, text);
};

const getTelegramToken = async (clientId: string) => {
  const token = await getTelegramBotToken(clientId);

  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  return token;
};

const sendNotificationTelegramVoice = async (
  chatId: string,
  voice: TelegramVoiceUpload,
  clientId: string,
) => {
  await sendTelegramVoice(await getTelegramToken(clientId), chatId, voice);
};

const sendNotificationTelegramImage = async (
  chatId: string,
  image: TelegramPhotoUpload,
  clientId: string,
) => {
  await sendTelegramPhoto(await getTelegramToken(clientId), chatId, image);
};

export const sendNotificationText = async (
  notificationChannel: UserNotificationChannel,
  text: string,
) => {
  switch (notificationChannel.type) {
    case "telegram":
      await sendNotificationTelegramText(
        notificationChannel.userId,
        text,
        notificationChannel.clientId,
      );
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
  notificationChannel: UserNotificationChannel,
  voice: TelegramVoiceUpload,
) => {
  switch (notificationChannel.type) {
    case "telegram":
      await sendNotificationTelegramVoice(
        notificationChannel.userId,
        voice,
        notificationChannel.clientId,
      );
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
  notificationChannel: UserNotificationChannel,
  image: TelegramPhotoUpload,
) => {
  switch (notificationChannel.type) {
    case "telegram":
      await sendNotificationTelegramImage(
        notificationChannel.userId,
        image,
        notificationChannel.clientId,
      );
      return;
    case "web":
      throw new Error("TODO: Web notification delivery is not implemented");
    case "react-native":
      throw new Error("TODO: React Native notification delivery is not implemented");
    case "flutter":
      throw new Error("TODO: Flutter notification delivery is not implemented");
  }
};
