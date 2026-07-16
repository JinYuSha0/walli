import { Hono } from "hono";
import { z } from "zod";
import { hasAdminRole } from "./auth";
import type { AppBindings } from "./types";
import {
  appSessionSchema,
  appUserSchema,
  emptyQuerySchema,
  parseResponse,
  validateQuery,
} from "./validation";

const meResponseSchema = z.union([
  z
    .object({
      user: appUserSchema,
      session: appSessionSchema,
      isAdmin: z.boolean(),
    })
    .strict(),
  z
    .object({
      user: z.null(),
      session: z.null(),
      isAdmin: z.literal(false),
    })
    .strict(),
]);

export const meRoute = new Hono<AppBindings>();

meRoute.get("/api/me", validateQuery(emptyQuerySchema), (c) => {
  const user = c.get("user");
  const session = c.get("session");

  if (!user || !session) {
    return c.json(
      parseResponse(meResponseSchema, { user: null, session: null, isAdmin: false }),
      401,
    );
  }

  return c.json(
    parseResponse(meResponseSchema, {
      user,
      session,
      isAdmin: hasAdminRole(user, c.env),
    }),
  );
});
