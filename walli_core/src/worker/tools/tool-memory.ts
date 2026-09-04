import { Hono } from "hono";
import { z } from "zod";
import { clientPlatformSchema } from "@shared/client";
import type { AppBindings } from "../api/types";
import { getAsyncContext } from "../lib/async-context";
import { resolveToolRequestIdentity } from "./request-context";
import { createUserDoName, type UserDoClientPlatform } from "../durable-objects/user/types";

const memorySearchSchema = z
  .object({
    query: z.string().trim().min(1),
    clientId: z.string().trim().min(1),
    userId: z.string().trim().min(1),
    clientPlatform: clientPlatformSchema,
    sessionId: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(20).default(5),
  })
  .strict();

const memorySummarySchema = z
  .object({
    clientId: z.string().trim().min(1),
    userId: z.string().trim().min(1),
    clientPlatform: clientPlatformSchema,
    startMessageId: z.string().trim().min(1),
    endMessageId: z.string().trim().min(1),
    user: z.string().trim().default(""),
    memory: z.string().trim().default(""),
  })
  .strict()
  .refine((input) => input.user.length > 0 || input.memory.length > 0, {
    message: "At least one memory content field is required",
    path: ["memory"],
  });

const getUserDO = (input: {
  clientId: string;
  clientPlatform: UserDoClientPlatform;
  userId: string;
}) =>
  getAsyncContext().env.USER_DO.getByName(
    createUserDoName(input.clientId, input.clientPlatform, input.userId),
  );

export const memoryToolRoute = new Hono<AppBindings>()
  .post("/api/tools/memory/search", async (c) => {
    const result = memorySearchSchema.safeParse(
      resolveToolRequestIdentity(await c.req.json().catch(() => null)),
    );

    if (!result.success) {
      return c.json(
        {
          error: "Invalid body",
          issues: z.treeifyError(result.error),
        },
        400,
      );
    }

    const userDO = getUserDO(result.data);
    const memories = await userDO.searchMemory({
      query: result.data.query,
      sessionId: result.data.sessionId,
      limit: result.data.limit,
    });

    return c.json({ memories });
  })
  .post("/api/tools/memory/summary", async (c) => {
    const result = memorySummarySchema.safeParse(
      resolveToolRequestIdentity(await c.req.json().catch(() => null)),
    );

    if (!result.success) {
      return c.json(
        {
          error: "Invalid body",
          issues: z.treeifyError(result.error),
        },
        400,
      );
    }

    const userDO = getUserDO(result.data);
    const memories = await userDO.recordMemorySummary({
      startMessageId: result.data.startMessageId,
      endMessageId: result.data.endMessageId,
      user: result.data.user,
      memory: result.data.memory,
    });

    return c.json({ memories }, 201);
  });
