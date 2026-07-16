import type { MiddlewareHandler } from "hono";
import { z } from "zod";

export const emptyQuerySchema = z.object({}).strict();

export const errorResponseSchema = z
  .object({
    error: z.string(),
    requiredRole: z.string().optional(),
  })
  .strict();

export const appUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable().optional(),
    role: z
      .union([z.string(), z.array(z.string())])
      .nullable()
      .optional(),
  })
  .passthrough();

export const appSessionSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    expiresAt: z.date(),
    token: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
    ipAddress: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
    impersonatedBy: z.string().nullable().optional(),
  })
  .passthrough();

export const validateQuery =
  <Schema extends z.ZodType>(schema: Schema): MiddlewareHandler =>
  async (c, next) => {
    const result = schema.safeParse(c.req.query());

    if (!result.success) {
      return c.json(
        {
          error: "Invalid query",
          issues: z.treeifyError(result.error),
        },
        400,
      );
    }

    await next();
  };

export const parseResponse = <Schema extends z.ZodType>(
  schema: Schema,
  data: z.input<Schema>,
): z.output<Schema> => schema.parse(data);
