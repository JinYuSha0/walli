import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "./types";
import { emptyQuerySchema, parseResponse, validateQuery } from "./helper/validation";

const apiInfoResponseSchema = z
  .object({
    name: z.literal("walli_core"),
    auth: z.literal("better-auth"),
  })
  .strict();

export const rootRoute = new Hono<AppBindings>().get(
  "/api/",
  validateQuery(emptyQuerySchema),
  (c) =>
    c.json(
      parseResponse(apiInfoResponseSchema, {
        name: "walli_core",
        auth: "better-auth",
      }),
    ),
);
