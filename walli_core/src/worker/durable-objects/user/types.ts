import { CLIENT_PLATFORMS, type ClientPlatform } from "../../../shared/client";

export type UserDoClientPlatform = ClientPlatform;
export type UserDoName = `${string}:${UserDoClientPlatform}:${string}`;
export type UserNotificationChannel =
  | {
      type: "telegram";
      userId: string;
      clientId: string;
    }
  | {
      type: "web";
      userId: string;
      clientId: string;
    }
  | {
      type: "react-native";
      userId: string;
      clientId: string;
    }
  | {
      type: "flutter";
      userId: string;
      clientId: string;
    };

export type UserDoIdentity = {
  clientId: string;
  type: UserDoClientPlatform;
  userId: string;
};

export const createUserDoName = (
  clientId: string,
  platform: UserDoClientPlatform,
  userId: string,
): UserDoName => `${clientId}:${platform}:${userId}`;

export const createUserNotificationChannel = (
  platform: UserDoClientPlatform,
  userId: string,
  clientId: string,
): UserNotificationChannel => {
  return {
    type: platform,
    userId,
    clientId,
  };
};

const isUserDoClientPlatform = (platform: string): platform is UserDoClientPlatform =>
  CLIENT_PLATFORMS.includes(platform as UserDoClientPlatform);

export const parseUserDoIdentity = (name: string | undefined): UserDoIdentity | null => {
  if (!name) {
    return null;
  }

  const clientSeparatorIndex = name.indexOf(":");
  const platformSeparatorIndex = name.indexOf(":", clientSeparatorIndex + 1);

  if (
    clientSeparatorIndex <= 0 ||
    platformSeparatorIndex <= clientSeparatorIndex + 1 ||
    platformSeparatorIndex === name.length - 1
  ) {
    return null;
  }

  const clientId = name.slice(0, clientSeparatorIndex);
  const platform = name.slice(clientSeparatorIndex + 1, platformSeparatorIndex);
  const userId = name.slice(platformSeparatorIndex + 1);

  return isUserDoClientPlatform(platform) ? { clientId, type: platform, userId } : null;
};
