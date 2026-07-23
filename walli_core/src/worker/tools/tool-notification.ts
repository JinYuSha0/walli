import { dynamicTool, type ToolSet } from "ai";
import { z } from "zod";
import type { UserNotificationChannel } from "../durable-objects/user/types";
import { sendNotificationText } from "@worker/utils/notification";

export const createNotificationTools = (
  env: Env,
  notificationChannel: UserNotificationChannel | null,
): ToolSet => {
  if (!notificationChannel) {
    return {};
  }

  const inputSchema = z.object({
    text: z.string().trim().min(1).describe("Notification text to send to the user."),
  });

  return {
    send_notification: dynamicTool({
      description:
        "Send a notification message to the user's configured notification channel. Use this when the scheduled task asks you to remind, notify, send, or push a message.",
      inputSchema,
      execute: async (input) => {
        const { text } = inputSchema.parse(input);

        await sendNotificationText(env, notificationChannel, text);

        return {
          ok: true,
          channel: notificationChannel.type,
        };
      },
    }),
  };
};
