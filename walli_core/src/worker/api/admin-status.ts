import { Hono } from "hono";
import { z } from "zod";
import { hasAdminRole } from "./auth";
import type { AppBindings } from "./types";
import {
  appUserSchema,
  emptyQuerySchema,
  errorResponseSchema,
  parseResponse,
  validateQuery,
} from "./validation";

const adminStatusResponseSchema = z
  .object({
    ok: z.literal(true),
    message: z.literal("Admin role verified"),
    user: appUserSchema,
  })
  .strict();

export const adminStatusRoute = new Hono<AppBindings>()
  .use("/api/admin/*", async (c, next) => {
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
  })
  .get("/api/admin/status", validateQuery(emptyQuerySchema), (c) => {
    const user = c.get("user");

    if (!user) {
      return c.json(parseResponse(errorResponseSchema, { error: "Unauthorized" }), 401);
    }

    return c.json(
      parseResponse(adminStatusResponseSchema, {
        ok: true,
        message: "Admin role verified",
        user,
      }),
    );
  });
