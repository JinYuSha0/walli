import { Hono } from "hono";
import { z } from "zod";
import { clientPlatformSchema } from "@shared/client";
import type { AppBindings } from "../api/types";
import { createUserDoName, type UserDoClientPlatform } from "../durable-objects/user/types";

const memorySearchSchema = z
  .object({
    query: z.string().trim().min(1),
    userId: z.string().trim().min(1),
    clientPlatform: clientPlatformSchema,
    sessionId: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(20).default(5),
  })
  .strict();

const normalizeUserDoName = (platform: UserDoClientPlatform, userId: string) =>
  userId.startsWith(`${platform}:`) ? userId : createUserDoName(platform, userId);

export const memoryToolRoute = new Hono<AppBindings>().post(
  "/api/tools/memory/search",
  async (c) => {
    const result = memorySearchSchema.safeParse(await c.req.json().catch(() => null));

    if (!result.success) {
      return c.json(
        {
          error: "Invalid body",
          issues: z.treeifyError(result.error),
        },
        400,
      );
    }

    const userDO = c.env.USER_DO.getByName(
      normalizeUserDoName(result.data.clientPlatform, result.data.userId),
    );
    const memories = await userDO.searchMemory({
      query: result.data.query,
      sessionId: result.data.sessionId,
      limit: result.data.limit,
    });

    return c.json({ memories });
  },
);
