import type { MiddlewareHandler } from "hono";
import { hasAdminRole } from "./auth";
import type { AppBindings } from "../types";
import { errorResponseSchema, parseResponse } from "./validation";

export const requireAdmin: MiddlewareHandler<AppBindings> = async (c, next) => {
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
