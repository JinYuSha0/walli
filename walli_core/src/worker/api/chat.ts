import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { isStepCount, streamText } from "ai";
import { z } from "zod";
import type { ModelMessage } from "ai";
import type { AppBindings } from "./types";
import { getSettings } from "./settings";
import { buildChatTools } from "../lib/chat-tools";
import { createGateway, unified } from "../lib/llm";

const chatMessageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })
  .strict();

const chatRequestSchema = z
  .object({
    appId: z.string().optional(),
    userId: z.string().optional(),
    token: z.string().optional(),
    messages: z.array(chatMessageSchema).min(1),
  })
  .strict();

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: "Unknown error",
  };
};

const stringifySseData = (data: unknown) => JSON.stringify(data);

const verifyChatAuth = async (
  settings: Awaited<ReturnType<typeof getSettings>>,
  credentials: {
    appId?: string;
    userId?: string;
    token?: string;
  },
) => {
  if (!settings.authEnabled) {
    return true;
  }

  if (
    !settings.authEndpointUrl.trim() ||
    !credentials.appId?.trim() ||
    !credentials.userId?.trim() ||
    !credentials.token?.trim()
  ) {
    return false;
  }

  try {
    const response = await fetch(settings.authEndpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        appId: credentials.appId,
        userId: credentials.userId,
        token: credentials.token,
      }),
    });

    return response.status === 200;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const chatRoute = new Hono<AppBindings>().post("/api/chat", async (c) => {
  const bodyResult = chatRequestSchema.safeParse(await c.req.json().catch(() => null));

  if (!bodyResult.success) {
    return c.json(
      {
        error: "Invalid body",
        issues: z.treeifyError(bodyResult.error),
      },
      400,
    );
  }

  const settings = await getSettings(c.env.APP_KV);
  const isAuthorized = await verifyChatAuth(settings, {
    appId: bodyResult.data.appId,
    userId: bodyResult.data.userId,
    token: bodyResult.data.token,
  });

  if (!isAuthorized) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const gateway = createGateway(c);
  const tools = buildChatTools(settings.tools, c.env);
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (stream) => {
    try {
      let fullContent = "";
      const result = streamText({
        model: gateway(unified(settings.primaryModel)),
        instructions: settings.globalPrompt || undefined,
        messages: bodyResult.data.messages as ModelMessage[],
        tools,
        toolChoice: "auto",
        stopWhen: isStepCount(5),
        abortSignal: c.req.raw.signal,
      });

      await stream.writeSSE({
        event: "start",
        data: stringifySseData({
          model: settings.primaryModel,
        }),
      });

      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          fullContent += part.text;
          await stream.writeSSE({
            event: "delta",
            data: stringifySseData({
              text: part.text,
            }),
          });
          continue;
        }

        if (part.type === "tool-call") {
          await stream.writeSSE({
            event: "tool-call",
            data: stringifySseData({
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            }),
          });
          continue;
        }

        if (part.type === "tool-result") {
          await stream.writeSSE({
            event: "tool-result",
            data: stringifySseData({
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            }),
          });
          continue;
        }

        if (part.type === "tool-error") {
          await stream.writeSSE({
            event: "tool-error",
            data: stringifySseData({
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              error: serializeError(part.error),
            }),
          });
          continue;
        }

        if (part.type === "finish") {
          await stream.writeSSE({
            event: "finish",
            data: stringifySseData({
              text: fullContent,
              finishReason: part.finishReason,
              usage: part.totalUsage,
            }),
          });
          continue;
        }

        if (part.type === "error") {
          await stream.writeSSE({
            event: "error",
            data: stringifySseData({
              error: serializeError(part.error),
            }),
          });
        }
      }
    } catch (error) {
      console.error(error);
      await stream.writeSSE({
        event: "error",
        data: stringifySseData({
          error: serializeError(error),
        }),
      });
    }
  });
});
