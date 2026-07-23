import { dynamicTool, type ToolSet } from "ai";
import { z } from "zod";
import type { UserNotificationChannel } from "../durable-objects/user/types";
import {
  sendNotificationImage,
  sendNotificationText,
  sendNotificationVoice,
} from "@worker/utils/notification";
import { synthesizeVoice } from "./tool-media";

export const createNotificationTools = (
  env: Env,
  notificationChannel: UserNotificationChannel | null,
  origin = "https://internal.local",
): ToolSet => {
  if (!notificationChannel) {
    return {};
  }

  const inputSchema = z
    .object({
      type: z
        .enum(["text", "voice", "image"])
        .default("text")
        .describe("Notification reply type. Defaults to text for backward compatibility."),
      text: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Text content. Required for text and voice notifications; optional image caption."),
      image: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Image HTTPS URL or data URI. Required when type is image."),
    })
    .superRefine((input, ctx) => {
      if ((input.type === "text" || input.type === "voice") && !input.text) {
        ctx.addIssue({
          code: "custom",
          path: ["text"],
          message: "Text is required for text and voice notifications",
        });
      }

      if (input.type === "image" && !input.image) {
        ctx.addIssue({
          code: "custom",
          path: ["image"],
          message: "Image is required for image notifications",
        });
      }
    });

  return {
    send_notification: dynamicTool({
      description:
        "Send a notification message to the user's configured notification channel. Use this when the scheduled task asks you to remind, notify, send, push a message, reply with voice, or reply with an image.",
      inputSchema,
      execute: async (input) => {
        const notification = inputSchema.parse(input);

        switch (notification.type) {
          case "voice": {
            const text = notification.text;

            if (!text) {
              throw new Error("Text is required for voice notifications");
            }

            const voice = await synthesizeVoice(env, origin, text);

            await sendNotificationVoice(env, notificationChannel, voice);
            break;
          }
          case "image": {
            const image = notification.image;

            if (!image) {
              throw new Error("Image is required for image notifications");
            }

            await sendNotificationImage(env, notificationChannel, {
              photo: image,
              caption: notification.text,
            });
            break;
          }
          case "text": {
            const text = notification.text;

            if (!text) {
              throw new Error("Text is required for text notifications");
            }

            await sendNotificationText(env, notificationChannel, text);
            break;
          }
        }

        return {
          ok: true,
          channel: notificationChannel.type,
          type: notification.type,
        };
      },
    }),
  };
};
