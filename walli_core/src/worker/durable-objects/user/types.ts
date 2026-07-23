import { CLIENT_PLATFORMS, type ClientPlatform } from "../../../shared/client";

export type UserDoClientPlatform = ClientPlatform;
export type UserDoName = `${UserDoClientPlatform}:${string}`;
export type UserNotificationChannel =
  | {
      type: "telegram";
      userId: string;
    }
  | {
      type: "web";
      userId: string;
    }
  | {
      type: "react-native";
      userId: string;
    }
  | {
      type: "flutter";
      userId: string;
    };

export const createUserDoName = (platform: UserDoClientPlatform, userId: string): UserDoName =>
  `${platform}:${userId}`;

export const createUserNotificationChannel = (
  platform: UserDoClientPlatform,
  userId: string,
): UserNotificationChannel => {
  return {
    type: platform,
    userId,
  };
};

const isUserDoClientPlatform = (platform: string): platform is UserDoClientPlatform =>
  CLIENT_PLATFORMS.includes(platform as UserDoClientPlatform);

export const parseUserDoNotificationChannel = (
  name: string | undefined,
): UserNotificationChannel | null => {
  if (!name) {
    return null;
  }

  const separatorIndex = name.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex === name.length - 1) {
    return null;
  }

  const platform = name.slice(0, separatorIndex);
  const id = name.slice(separatorIndex + 1);

  return isUserDoClientPlatform(platform) ? createUserNotificationChannel(platform, id) : null;
};
