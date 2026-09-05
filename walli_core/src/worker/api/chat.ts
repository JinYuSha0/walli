import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { isStepCount, streamText, toUIMessageStream, UI_MESSAGE_STREAM_HEADERS } from "ai";
import { z } from "zod";
import type { ModelMessage } from "ai";
import {
  getClientAuthSettings,
  getClientBasicSettings,
  getClientFromClientId,
} from "./clients";
import type { AppBindings } from "./types";
import { getAsyncContext } from "@worker/lib/async-context";
import { getSettings } from "./settings";
import { errorResponseSchema, parseResponse } from "./helper/validation";
import { requireAdmin } from "./helper/middleware";
import { handleCors } from "./helper/cors";
import { toWebHistoryMessage } from "./helper/chat-history";
import {
  ChatCompletionLimitError,
  createOutputTokenLimitOptions,
  createChatUserInfo,
  prepareChatCompletion,
  type ChatUserInfo,
} from "../lib/chat-runner";
import { createUserDoName, createUserNotificationChannel } from "../durable-objects/user/types";
import { ClientPlatform } from "@shared/client";

const chatMessageSchema = z
  .object({
    role: z.literal("user"),
    content: z.string(),
  })
  .strict();

const internalChatMessageSchema = z
  .object({
    role: z.literal("user"),
    content: z.string(),
  })
  .strict();

const chatRequestSchema = z
  .object({
    appId: z.string().optional(),
    userId: z.string().trim().min(1),
    token: z.string().optional(),
    sessionId: z.string().trim().min(1),
    messages: z.array(chatMessageSchema).length(1),
  })
  .strict();

const internalChatRequestSchema = z
  .object({
    sessionId: z.string().trim().min(1),
    messages: z.array(internalChatMessageSchema).length(1),
  })
  .strict();

const chatHistoryRequestSchema = z
  .object({
    appId: z.string().optional(),
    userId: z.string().trim().min(1),
    token: z.string().optional(),
    sessionId: z.string().trim().min(1),
    cursor: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(100).default(30),
  })
  .strict();

const chatSessionRequestSchema = z
  .object({
    appId: z.string().optional(),
    userId: z.string().trim().min(1),
    token: z.string().optional(),
  })
  .strict();

const chatSessionDeleteRequestSchema = chatSessionRequestSchema.extend({
  sessionId: z.string().trim().min(1),
});

const internalChatHistoryQuerySchema = z.object({
  sessionId: z.string().trim().min(1),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

type ParsedChatRequest = {
  sessionId: string;
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

const getChatHistoryPage = async (input: {
  clientId: string;
  clientPlatform: Parameters<typeof createUserDoName>[1];
  userId: string;
  sessionId: string;
  cursor?: number;
  limit: number;
}) => {
  const userDO = getAsyncContext().env.USER_DO.getByName(
    createUserDoName(input.clientId, input.clientPlatform, input.userId),
  );
  const [session, rows] = await Promise.all([
    userDO.getSession(input.sessionId),
    userDO.listMessagesBefore(input.sessionId, input.cursor, input.limit + 1),
  ]);
  const hasMore = rows.length > input.limit;
  const pageRows = hasMore ? rows.slice(1) : rows;

  return {
    sessionId: input.sessionId,
    title: session?.title ?? "",
    messages: pageRows.flatMap((message) => {
      const parsed = toWebHistoryMessage(message);
      return parsed ? [parsed] : [];
    }),
    nextCursor: hasMore && pageRows[0] ? pageRows[0].seq : null,
  };
};

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

export const verifyChatAuth = async (
  authSettings: Awaited<ReturnType<typeof getClientAuthSettings>>,
  credentials: {
    appId?: string;
    userId?: string;
    token?: string;
  },
) => {
  if (!authSettings.authEnabled) {
    return {
      authorized: true,
      userInfo: undefined,
    };
  }

  if (
    !authSettings.authEndpointUrl.trim() ||
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
    const response = await fetch(authSettings.authEndpointUrl, {
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

const streamChat = async (
  c: Context<AppBindings>,
  body: ParsedChatRequest,
  userInfo: ChatUserInfo,
  platform: ClientPlatform,
  additionalSystemPrompt = "",
) => {
  const settings = await getSettings();
  const resolvedUserInfo: ChatUserInfo = {
    ...userInfo,
    notificationChannel:
      userInfo.notificationChannel ??
      createUserNotificationChannel(platform, userInfo.userId, userInfo.clientId),
  };
  const userDO = getAsyncContext().env.USER_DO.getByName(
    createUserDoName(resolvedUserInfo.clientId, platform, resolvedUserInfo.userId),
  );
  let prepared: Awaited<ReturnType<typeof prepareChatCompletion>>;

  try {
    prepared = await prepareChatCompletion({
      userInfo: resolvedUserInfo,
      messages: body.messages as ModelMessage[],
      settings,
      session: {
        store: userDO,
        clientId: userInfo.clientId,
        sessionId: body.sessionId,
      },
      extraInstructions: additionalSystemPrompt,
    });
  } catch (error) {
    if (error instanceof ChatCompletionLimitError) {
      return c.json({ error: error.message, code: error.code }, 429);
    }

    throw error;
  }

  for (const [name, value] of Object.entries(UI_MESSAGE_STREAM_HEADERS)) {
    c.header(name, value);
  }

  return streamSSE(c, async (stream) => {
    let doneWritten = false;
    let errorWritten = false;
    const writeDone = async () => {
      if (doneWritten) return;
      doneWritten = true;
      await stream.writeSSE({ data: "[DONE]" });
    };

    try {
      let fullContent = "";
      const result = streamText({
        model: prepared.model,
        instructions: prepared.instructions,
        messages: prepared.messages,
        tools: prepared.tools,
        ...createOutputTokenLimitOptions(prepared.modelId, prepared.outputTokenLimit),
        toolChoice: "auto",
        stopWhen: isStepCount(5),
        abortSignal: c.req.raw.signal,
      });
      const createdAt = Date.now();

      const uiMessageStream = toUIMessageStream({
        stream: result.stream,
        tools: prepared.tools,
        sendReasoning: true,
        sendSources: true,
        generateMessageId: () => crypto.randomUUID(),
        messageMetadata: () => ({
          createdAt,
          model: settings.primaryModel,
          sessionId: prepared.sessionId,
        }),
        onError: (error) => serializeError(error).message,
      });

      for await (const chunk of uiMessageStream) {
        if (chunk.type === "text-delta") fullContent += chunk.delta;
        if (chunk.type === "error") errorWritten = true;
        await stream.writeSSE({ data: stringifySseData(chunk) });
      }

      if (!errorWritten) {
        const usage = await result.usage;
        prepared.persistMessages([{ role: "assistant", content: fullContent }], {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        });
      }
      await writeDone();
    } catch (error) {
      console.error(error);
      if (!errorWritten) {
        errorWritten = true;
        await stream.writeSSE({
          data: stringifySseData({
            type: "error",
            errorText: serializeError(error).message,
          }),
        });
      }
      await writeDone();
    }
  });
};


export const chatRoute = new Hono<AppBindings>()
  .use("/api/chat", handleCors())
  .use("/api/chat/*", handleCors())
  .post("/api/chat/session", async (c) => {
    const bodyResult = chatSessionRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!bodyResult.success) {
      return c.json({ error: "Invalid body", issues: z.treeifyError(bodyResult.error) }, 400);
    }

    const client = await getClientFromClientId(bodyResult.data.appId);
    if (!client) return c.json({ error: "Invalid appId" }, 403);
    const platform = client.platform;

    const basicSettings = await getClientBasicSettings(client.id);
    if (!basicSettings.enabled) return c.json({ error: "Client disabled" }, 403);

    const authSettings = await getClientAuthSettings(client.id);
    if (!authSettings.authEnabled) {
      return c.json(
        { error: "Auth disabled", message: "Enable auth before using the external chat API" },
        403,
      );
    }

    const authResult = await verifyChatAuth(authSettings, bodyResult.data);
    if (!authResult.authorized) return c.json({ error: "Forbidden" }, 403);

    const userDO = getAsyncContext().env.USER_DO.getByName(
      createUserDoName(client.id, platform, bodyResult.data.userId),
    );
    const session = await userDO.createSession({ clientId: client.id });

    return c.json(
      {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
      },
      201,
    );
  })
  .delete("/api/chat/session", async (c) => {
    const bodyResult = chatSessionDeleteRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!bodyResult.success) {
      return c.json({ error: "Invalid body", issues: z.treeifyError(bodyResult.error) }, 400);
    }

    const client = await getClientFromClientId(bodyResult.data.appId);
    if (!client) return c.json({ error: "Invalid appId" }, 403);
    const platform = client.platform;

    const basicSettings = await getClientBasicSettings(client.id);
    if (!basicSettings.enabled) return c.json({ error: "Client disabled" }, 403);

    const authSettings = await getClientAuthSettings(client.id);
    if (!authSettings.authEnabled) {
      return c.json(
        { error: "Auth disabled", message: "Enable auth before using the external chat API" },
        403,
      );
    }

    const authResult = await verifyChatAuth(authSettings, bodyResult.data);
    if (!authResult.authorized) return c.json({ error: "Forbidden" }, 403);

    const userDO = getAsyncContext().env.USER_DO.getByName(
      createUserDoName(client.id, platform, bodyResult.data.userId),
    );
    return c.json(await userDO.deleteSession(bodyResult.data.sessionId));
  })
  .post("/api/chat/history", async (c) => {
    const bodyResult = chatHistoryRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!bodyResult.success) {
      return c.json({ error: "Invalid body", issues: z.treeifyError(bodyResult.error) }, 400);
    }

    const client = await getClientFromClientId(bodyResult.data.appId);
    if (!client) return c.json({ error: "Invalid appId" }, 403);
    const platform = client.platform;

    const basicSettings = await getClientBasicSettings(client.id);
    if (!basicSettings.enabled) return c.json({ error: "Client disabled" }, 403);

    const authSettings = await getClientAuthSettings(client.id);
    if (!authSettings.authEnabled) {
      return c.json(
        { error: "Auth disabled", message: "Enable auth before using the external chat API" },
        403,
      );
    }

    const authResult = await verifyChatAuth(authSettings, bodyResult.data);
    if (!authResult.authorized) return c.json({ error: "Forbidden" }, 403);

    return c.json(
      await getChatHistoryPage({
        clientId: client.id,
        clientPlatform: platform,
        userId: bodyResult.data.userId,
        sessionId: bodyResult.data.sessionId,
        cursor: bodyResult.data.cursor,
        limit: bodyResult.data.limit,
      }),
    );
  })
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

    const client = await getClientFromClientId(bodyResult.data.appId);
    const platform = client?.platform;

    if (!platform) {
      return c.json({ error: "Invalid appId" }, 403);
    }

    const basicSettings = await getClientBasicSettings(client.id);

    if (!basicSettings.enabled) {
      return c.json({ error: "Client disabled" }, 403);
    }

    const authSettings = await getClientAuthSettings(client.id);

    if (!authSettings.authEnabled) {
      return c.json(
        {
          error: "Auth disabled",
          message: "Enable auth before using the external chat API",
        },
        403,
      );
    }

    const authResult = await verifyChatAuth(authSettings, {
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
      createChatUserInfo({
        authUserInfo: authResult.userInfo,
        userId: bodyResult.data.userId,
        clientId: client.id,
      }),
      platform,
      basicSettings.additionalSystemPrompt,
    );
  })
  .use("/api/internal/chat", requireAdmin)
  .use("/api/internal/chat/*", requireAdmin)
  .get("/api/internal/chat/history", async (c) => {
    const user = c.get("user");

    if (!user) {
      return c.json(parseResponse(errorResponseSchema, { error: "Unauthorized" }), 401);
    }

    const queryResult = internalChatHistoryQuerySchema.safeParse(c.req.query());

    if (!queryResult.success) {
      return c.json({ error: "Invalid query", issues: z.treeifyError(queryResult.error) }, 400);
    }

    return c.json(
      await getChatHistoryPage({
        clientId: "internal-web",
        clientPlatform: "web",
        userId: user.id,
        sessionId: queryResult.data.sessionId,
        cursor: queryResult.data.cursor,
        limit: queryResult.data.limit,
      }),
    );
  })
  .delete("/api/internal/chat/session", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(parseResponse(errorResponseSchema, { error: "Unauthorized" }), 401);
    }

    const queryResult = z.object({ sessionId: z.string().trim().min(1) }).safeParse(c.req.query());
    if (!queryResult.success) {
      return c.json({ error: "Invalid query", issues: z.treeifyError(queryResult.error) }, 400);
    }

    const userDO = getAsyncContext().env.USER_DO.getByName(
      createUserDoName("internal-web", "web", user.id),
    );
    return c.json(await userDO.deleteSession(queryResult.data.sessionId));
  })
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

    return streamChat(
      c,
      bodyResult.data,
      createChatUserInfo({
        userId: user.id,
        name: user.name,
        email: user.email,
        clientId: "internal-web",
      }),
      "web",
    );
  });
