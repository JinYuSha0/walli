import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { hasAdminRole } from "./auth";
import type { AppBindings } from "./types";
import {
  emptyQuerySchema,
  errorResponseSchema,
  parseResponse,
  validateQuery,
} from "./validation";

const settingsKey = "settings";

const settingsSchema = z
  .object({
    systemPrompt: z.string(),
    dialogSystemPrompt: z.string(),
    dialogOpeningMessage: z.string(),
  })
  .strict();

const settingsResponseSchema = settingsSchema;

const defaultSettings = {
  systemPrompt: "",
  dialogSystemPrompt: "",
  dialogOpeningMessage: "",
} satisfies z.infer<typeof settingsSchema>;

const getSettings = async (appKv: KVNamespace) => {
  const savedSettings = await appKv.get<unknown>(settingsKey, "json");
  const result = settingsSchema.safeParse(savedSettings);

  if (!result.success) {
    return defaultSettings;
  }

  return result.data;
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

export const settingsRoute = new Hono<AppBindings>()
  .get("/api/settings", validateQuery(emptyQuerySchema), async (c) => {
    const settings = await getSettings(c.env.APP_KV);

    return c.json(parseResponse(settingsResponseSchema, settings));
  })
  .use("/api/admin/settings", requireAdmin)
  .put("/api/admin/settings", async (c) => {
    const result = settingsSchema.safeParse(await c.req.json().catch(() => null));

    if (!result.success) {
      return c.json(
        {
          error: "Invalid body",
          issues: z.treeifyError(result.error),
        },
        400,
      );
    }

    await c.env.APP_KV.put(settingsKey, JSON.stringify(result.data));

    return c.json(parseResponse(settingsResponseSchema, result.data));
  });
