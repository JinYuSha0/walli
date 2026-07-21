import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { isStepCount, streamText } from "ai";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { hasAdminRole } from "./auth";
import type { AppBindings } from "./types";
import { getSettings } from "./settings";
import { errorResponseSchema, parseResponse } from "./validation";
import {
  createChatRunnerInstructions,
  createChatRunnerTools,
} from "../lib/chat-runner";
import { createGateway, unified } from "../lib/llm";

const chatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })
  .strict();

const internalChatMessageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })
  .strict();

const chatRequestSchema = z
  .object({
    appId: z.string().optional(),
    userId: z.string().trim().min(1),
    token: z.string().optional(),
    messages: z.array(chatMessageSchema).min(1),
  })
  .strict();

const internalChatRequestSchema = z
  .object({
    messages: z.array(internalChatMessageSchema).min(1),
  })
  .strict();

type ParsedChatRequest = {
  messages: Array<z.infer<typeof internalChatMessageSchema>>;
};

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

const getUserInfoFromAuthBody = (body: unknown) => {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }

  if ("userInfo" in body) {
    return body.userInfo;
  }

  if ("data" in body) {
    const data = body.data;

    if (typeof data === "object" && data !== null && "userInfo" in data) {
      return data.userInfo;
    }
  }

  return undefined;
};

const createAuthenticatedUserInfo = (userInfo: unknown, fallbackUserId: string) => {
  if (typeof userInfo === "object" && userInfo !== null && !Array.isArray(userInfo)) {
    const userInfoRecord = userInfo as Record<string, unknown>;
    const returnedUserId = userInfoRecord.userId;

    if (typeof returnedUserId === "string" && returnedUserId.trim().length > 0) {
      return userInfoRecord;
    }

    return {
      ...userInfoRecord,
      userId: fallbackUserId,
    };
  }

  return {
    userId: fallbackUserId,
  };
};

const verifyChatAuth = async (
  settings: Awaited<ReturnType<typeof getSettings>>,
  credentials: {
    appId?: string;
    userId?: string;
    token?: string;
  },
) => {
  if (!settings.authEnabled) {
    return {
      authorized: true,
      userInfo: undefined,
    };
  }

  if (
    !settings.authEndpointUrl.trim() ||
    !credentials.appId?.trim() ||
    !credentials.userId?.trim() ||
    !credentials.token?.trim()
  ) {
    return {
      authorized: false,
      userInfo: undefined,
    };
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

    if (response.status !== 200) {
      return {
        authorized: false,
        userInfo: undefined,
      };
    }

    const body = await response.json().catch(() => undefined);

    return {
      authorized: true,
      userInfo: getUserInfoFromAuthBody(body),
    };
  } catch (error) {
    console.error(error);
    return {
      authorized: false,
      userInfo: undefined,
    };
  }
};

const streamChat = async (c: Context<AppBindings>, body: ParsedChatRequest, userInfo: unknown) => {
  const settings = await getSettings(c.env.APP_KV);
  const gateway = createGateway(c);
  const origin = new URL(c.req.url).origin;
  const tools = createChatRunnerTools(settings, c.env, origin);
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (stream) => {
    try {
      let fullContent = "";
      const result = streamText({
        model: gateway(unified(settings.primaryModel)),
        instructions: createChatRunnerInstructions(settings.globalPrompt, userInfo),
        messages: body.messages as ModelMessage[],
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
};

const requireAdmin: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json(parseResponse(errorResponseSchema, { error: "Unauthorized" }), 401);
  }

  if (!hasAdminRole(user, c.env)) {
    return c.json(
      parseResponse(errorResponseSchema, { error: "Forbidden", requiredRole: "admin" }),
      403,
    );
  }

  await next();
};

export const chatRoute = new Hono<AppBindings>()
  .post("/api/chat", async (c) => {
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

    if (!settings.authEnabled) {
      return c.json(
        {
          error: "Auth disabled",
          message: "Enable auth before using the external chat API",
        },
        403,
      );
    }

    const authResult = await verifyChatAuth(settings, {
      appId: bodyResult.data.appId,
      userId: bodyResult.data.userId,
      token: bodyResult.data.token,
    });

    if (!authResult.authorized) {
      return c.json({ error: "Forbidden" }, 403);
    }

    return streamChat(
      c,
      bodyResult.data,
      createAuthenticatedUserInfo(authResult.userInfo, bodyResult.data.userId),
    );
  })
  .use("/api/internal/chat", requireAdmin)
  .post("/api/internal/chat", async (c) => {
    const user = c.get("user");

    if (!user) {
      return c.json(parseResponse(errorResponseSchema, { error: "Unauthorized" }), 401);
    }

    const bodyResult = internalChatRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!bodyResult.success) {
      return c.json(
        {
          error: "Invalid body",
          issues: z.treeifyError(bodyResult.error),
        },
        400,
      );
    }

    return streamChat(c, bodyResult.data, {
      id: user.id,
      name: user.name,
      email: user.email,
    });
  });
