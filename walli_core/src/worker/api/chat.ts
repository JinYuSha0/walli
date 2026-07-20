import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { isStepCount, streamText } from "ai";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { BUILT_IN_TOOLS, type ToolConfig } from "../../shared/const";
import type { AppBindings } from "./types";
import { getSettings } from "./settings";
import { toolsRoute } from "./tools";
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

const createChatInstructions = (globalPrompt: string, userInfo: unknown) => {
  const instructions = globalPrompt.trim();

  if (userInfo === undefined) {
    return instructions || undefined;
  }

  return [
    instructions,
    `Current authenticated userInfo: ${JSON.stringify(userInfo)}`,
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");
};

const createBuiltInTools = (env: Env, origin: string): ToolConfig[] =>
  BUILT_IN_TOOLS.map((tool) => ({
    ...tool,
    invocation:
      tool.invocation.type === "api"
        ? {
            ...tool.invocation,
            url: new URL(tool.invocation.url, origin).toString(),
            headers: [
              {
                name: "authorization",
                defaultValue: `Bearer ${env.API_TOKEN}`,
              },
            ],
          }
        : tool.invocation,
  }));

const createInternalToolFetch =
  (env: Env, origin: string): typeof fetch =>
  async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());

    if (url.origin === origin && url.pathname.startsWith("/api/tools/")) {
      return toolsRoute.fetch(
        new Request(url, {
          method: init?.method,
          headers: init?.headers,
          body: init?.body,
        }),
        env,
      );
    }

    return fetch(input, init);
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
  const authResult = await verifyChatAuth(settings, {
    appId: bodyResult.data.appId,
    userId: bodyResult.data.userId,
    token: bodyResult.data.token,
  });

  if (!authResult.authorized) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const gateway = createGateway(c);
  const origin = new URL(c.req.url).origin;
  const tools = buildChatTools(
    [
      ...createBuiltInTools(c.env, origin),
      ...settings.tools,
    ],
    {
      AI: c.env.AI,
      fetch: createInternalToolFetch(c.env, origin),
    },
  );
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (stream) => {
    try {
      let fullContent = "";
      const result = streamText({
        model: gateway(unified(settings.primaryModel)),
        instructions: createChatInstructions(settings.globalPrompt, authResult.userInfo),
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
