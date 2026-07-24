import { Hono } from "hono";
import { z } from "zod";
import { clientPlatformSchema } from "@shared/client";
import type { AppBindings } from "../api/types";
import { createUserDoName, type UserDoClientPlatform } from "../durable-objects/user/types";
import { parseCronSchedule } from "../utils/cron";

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());

    return true;
  } catch {
    return false;
  }
};

const scheduledTaskActionSchema = z
  .object({
    action: z.enum(["create", "list", "cancel"]),
    userId: z.string().trim().min(1),
    clientPlatform: clientPlatformSchema,
    taskId: z.string().trim().optional(),
    status: z.enum(["pending", "completed", "failed", "canceled", "all"]).default("pending"),
    type: z.string().trim().min(1).default("generic"),
    description: z.string().trim().min(1).optional(),
    payload: z.unknown().default({}),
    scheduledAt: z.number().int().min(0).optional(),
    delayMs: z.number().int().min(0).optional(),
    cron: z.string().trim().min(1).optional(),
    timeZone: z.string().trim().min(1).default("UTC"),
    recurrenceEndAt: z.number().int().min(0).optional(),
    maxRuns: z.number().int().min(1).optional(),
    maxRetry: z.number().int().min(1).default(1),
  })
  .strict()
  .superRefine((task, ctx) => {
    if (
      task.action === "create" &&
      task.scheduledAt === undefined &&
      task.delayMs === undefined &&
      !task.cron
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "scheduledAt, delayMs, or cron is required when action is create",
      });
    }

    if (task.action === "create" && !task.description) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "description is required when action is create",
      });
    }

    if (task.action === "create" && task.recurrenceEndAt !== undefined) {
      const scheduledAt = task.scheduledAt ?? Date.now() + (task.delayMs ?? 0);

      if (task.recurrenceEndAt <= scheduledAt) {
        ctx.addIssue({
          code: "custom",
          path: ["recurrenceEndAt"],
          message: "recurrenceEndAt must be greater than scheduledAt",
        });
      }
    }

    if (task.action === "create" && task.cron) {
      try {
        parseCronSchedule(task.cron);
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["cron"],
          message: "cron must be a valid 5-field cron expression",
        });
      }

      if (!isValidTimeZone(task.timeZone)) {
        ctx.addIssue({
          code: "custom",
          path: ["timeZone"],
          message: "timeZone must be a valid IANA time zone",
        });
      }
    }

    if (task.action === "cancel" && !task.taskId) {
      ctx.addIssue({
        code: "custom",
        path: ["taskId"],
        message: "taskId is required when action is cancel",
      });
    }
  });

const normalizeUserDoName = (platform: UserDoClientPlatform, userId: string) =>
  userId.startsWith(`${platform}:`) ? userId : createUserDoName(platform, userId);

const getListTasksLimit = (status: z.output<typeof scheduledTaskActionSchema>["status"]) =>
  status === "pending" ? undefined : 20;

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
};

export const scheduledTaskToolRoute = new Hono<AppBindings>().post(
  "/api/tools/scheduled-tasks",
  async (c) => {
    const result = scheduledTaskActionSchema.safeParse(await c.req.json().catch(() => null));

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

    try {
      if (result.data.action === "create") {
        const { delayMs, ...taskInput } = result.data;
        const scheduledAt =
          taskInput.scheduledAt ?? (delayMs === undefined ? undefined : Date.now() + delayMs);
        const task = await userDO.createTask({
          ...taskInput,
          scheduledAt,
          description: taskInput.description!,
        });

        return c.json({ task }, 201);
      }

      if (result.data.action === "list") {
        const tasks = await userDO.listTasks(
          result.data.status,
          getListTasksLimit(result.data.status),
        );

        return c.json({ tasks });
      }

      const task = await userDO.cancelTask(result.data.taskId!);

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      return c.json({ task });
    } catch (error) {
      console.error(error);
      return c.json(
        {
          error: "Scheduled task operation failed",
          message: serializeError(error),
        },
        500,
      );
    }
  },
);
