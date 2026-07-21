import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../api/types";
import { scheduledTaskToolRoute } from "./tool-scheduled-task";
import { timestampToolRoute } from "./tool-timestamp";

const hasValidApiToken = (request: Request, env: Env) => {
  const token = env.API_TOKEN?.trim();

  if (!token) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${token}`;
};

const requireApiToken: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!hasValidApiToken(c.req.raw, c.env)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
};

export const toolsRoute = new Hono<AppBindings>()
  .use("/api/tools/*", requireApiToken)
  .route("/", timestampToolRoute)
  .route("/", scheduledTaskToolRoute);
