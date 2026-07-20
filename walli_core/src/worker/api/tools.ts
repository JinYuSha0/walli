import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "./types";
import { parseResponse } from "./validation";

const timestampResponseSchema = z
  .object({
    timestamp: z.number().int(),
    unixSeconds: z.number().int(),
    iso: z.string(),
    timeZone: z.string(),
    datetime: z.string(),
  })
  .strict();

const formatDateTime = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const valueMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${valueMap.year}-${valueMap.month}-${valueMap.day} ${valueMap.hour}:${valueMap.minute}:${valueMap.second}`;
};

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());

    return true;
  } catch {
    return false;
  }
};

const hasValidApiToken = (request: Request, env: Env) => {
  const token = env.API_TOKEN?.trim();

  if (!token) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${token}`;
};

export const toolsRoute = new Hono<AppBindings>()
  .use("/api/tools/*", async (c, next) => {
    if (!hasValidApiToken(c.req.raw, c.env)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await next();
  })
  .get("/api/tools/timestamp", (c) => {
    const requestedTimeZone = c.req.query("timeZone")?.trim() || "UTC";

    if (!isValidTimeZone(requestedTimeZone)) {
      return c.json({ error: "Invalid timeZone" }, 400);
    }

    const timestamp = Date.now();
    const date = new Date(timestamp);

    return c.json(
      parseResponse(timestampResponseSchema, {
        timestamp,
        unixSeconds: Math.floor(timestamp / 1000),
        iso: date.toISOString(),
        timeZone: requestedTimeZone,
        datetime: formatDateTime(date, requestedTimeZone),
      }),
    );
  });
