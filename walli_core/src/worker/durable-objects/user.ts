import { DurableObject } from "cloudflare:workers";
import { and, asc, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ModelMessage } from "ai";
import { runChatCompletion } from "../lib/chat-runner";
import { getNextCronScheduledAt } from "../utils/cron";

const scheduledTasks = sqliteTable("scheduled_tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  payload: text("payload").notNull(),
  scheduledAt: integer("scheduled_at").notNull(),
  cron: text("cron"),
  timeZone: text("time_zone"),
  recurrenceEndAt: integer("recurrence_end_at"),
  maxRuns: integer("max_runs"),
  runNumber: integer("run_number").notNull(),
  maxRetry: integer("max_retry").notNull(),
  retryCount: integer("retry_count").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  executedAt: integer("executed_at"),
  canceledAt: integer("canceled_at"),
  lastError: text("last_error"),
});

export type ScheduledTaskStatus = "pending" | "completed" | "failed" | "canceled";
export type ScheduledTaskStatusFilter = ScheduledTaskStatus | "all";

export type ScheduledTask = {
  id: string;
  userId: string;
  type: string;
  description: string;
  payload: unknown;
  scheduledAt: number;
  cron: string | null;
  timeZone: string | null;
  recurrenceEndAt: number | null;
  maxRuns: number | null;
  runNumber: number;
  maxRetry: number;
  retryCount: number;
  status: ScheduledTaskStatus;
  createdAt: number;
  updatedAt: number;
  executedAt: number | null;
  canceledAt: number | null;
  lastError: string | null;
};

export type CreateScheduledTaskInput = {
  id?: string;
  userId: string;
  type: string;
  description: string;
  payload: unknown;
  scheduledAt?: number;
  cron?: string | null;
  timeZone?: string | null;
  recurrenceEndAt?: number | null;
  maxRuns?: number | null;
  runNumber?: number;
  maxRetry?: number;
  retryCount?: number;
};

type ScheduledTaskRow = typeof scheduledTasks.$inferSelect;

const parseTaskPayload = (payload: string) => {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
};

const toScheduledTask = (row: ScheduledTaskRow): ScheduledTask => ({
  id: row.id,
  userId: row.userId,
  type: row.type,
  description: row.description,
  payload: parseTaskPayload(row.payload),
  scheduledAt: row.scheduledAt,
  cron: row.cron,
  timeZone: row.timeZone,
  recurrenceEndAt: row.recurrenceEndAt,
  maxRuns: row.maxRuns,
  runNumber: row.runNumber,
  maxRetry: row.maxRetry,
  retryCount: row.retryCount,
  status: row.status as ScheduledTaskStatus,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  executedAt: row.executedAt,
  canceledAt: row.canceledAt,
  lastError: row.lastError,
});

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
};

const isScheduledTaskMessage = (value: unknown): value is ModelMessage => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const message = value as Record<string, unknown>;

  return (
    (message.role === "system" || message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
};

const createTaskMessages = (task: ScheduledTaskRow): ModelMessage[] => {
  const payload = parseTaskPayload(task.payload);

  if (typeof payload === "object" && payload !== null && "messages" in payload) {
    const messages = (payload as { messages?: unknown }).messages;

    if (Array.isArray(messages) && messages.length > 0 && messages.every(isScheduledTaskMessage)) {
      return messages;
    }
  }

  return [
    {
      role: "user",
      content: [
        "Execute this scheduled task now.",
        "If this task asks to notify, remind, send, or push a message, use the available delivery tools such as Telegram or other configured messaging tools.",
        "Do not only generate a text response when a delivery tool is available and the task requires sending a message.",
        `Task description: ${task.description}`,
        `Task type: ${task.type}`,
        `Task payload: ${task.payload}`,
      ].join("\n"),
    },
  ];
};

export class User extends DurableObject<Env> {
  private readonly db: ReturnType<typeof drizzle<{ scheduledTasks: typeof scheduledTasks }>>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = drizzle(ctx.storage, { schema: { scheduledTasks } });

    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          description TEXT NOT NULL,
          payload TEXT NOT NULL,
          scheduled_at INTEGER NOT NULL,
          cron TEXT,
          time_zone TEXT,
          recurrence_end_at INTEGER,
          max_runs INTEGER,
          run_number INTEGER NOT NULL,
          max_retry INTEGER NOT NULL,
          retry_count INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          executed_at INTEGER,
          canceled_at INTEGER,
          last_error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due
          ON scheduled_tasks (status, scheduled_at);
      `);
    });
  }

  async createTask(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
    const now = Date.now();
    const taskId = input.id ?? crypto.randomUUID();
    const scheduledAt =
      input.scheduledAt ??
      (input.cron ? getNextCronScheduledAt(input.cron, input.timeZone ?? "UTC", now) : undefined);

    if (scheduledAt === undefined) {
      throw new Error("scheduledAt is required for one-time scheduled tasks");
    }

    const row = this.db
      .insert(scheduledTasks)
      .values({
        id: taskId,
        userId: input.userId,
        type: input.type,
        description: input.description,
        payload: JSON.stringify(input.payload),
        scheduledAt,
        cron: input.cron ?? null,
        timeZone: input.cron ? (input.timeZone ?? "UTC") : null,
        recurrenceEndAt: input.recurrenceEndAt ?? null,
        maxRuns: input.maxRuns ?? null,
        runNumber: input.runNumber ?? 1,
        maxRetry: input.maxRetry ?? 1,
        retryCount: input.retryCount ?? 0,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        executedAt: null,
        canceledAt: null,
        lastError: null,
      })
      .returning()
      .get();

    await this.scheduleNextAlarm();

    return toScheduledTask(row);
  }

  async listTasks(status: ScheduledTaskStatusFilter = "pending"): Promise<ScheduledTask[]> {
    const query = this.db.select().from(scheduledTasks).$dynamic();

    if (status !== "all") {
      query.where(eq(scheduledTasks.status, status));
    }

    return query
      .orderBy(asc(scheduledTasks.scheduledAt), asc(scheduledTasks.createdAt))
      .all()
      .map(toScheduledTask);
  }

  async cancelTask(taskId: string): Promise<ScheduledTask | null> {
    const now = Date.now();
    const row = this.db
      .update(scheduledTasks)
      .set({
        status: "canceled",
        updatedAt: now,
        canceledAt: now,
      })
      .where(and(eq(scheduledTasks.id, taskId), eq(scheduledTasks.status, "pending")))
      .returning()
      .get();

    await this.scheduleNextAlarm();

    return row ? toScheduledTask(row) : null;
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const dueTasks = this.db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.status, "pending"), lte(scheduledTasks.scheduledAt, now)))
      .orderBy(asc(scheduledTasks.scheduledAt), asc(scheduledTasks.createdAt))
      .all();

    for (const task of dueTasks) {
      await this.executeTask(task);
    }

    await this.scheduleNextAlarm();
  }

  private async executeTask(task: ScheduledTaskRow): Promise<void> {
    const now = Date.now();

    try {
      await this.runTask(task);
    } catch (error) {
      const nextRetryCount = task.retryCount + 1;
      const maxRetry = Math.max(task.maxRetry, 1);
      const lastError = serializeError(error);

      if (nextRetryCount < maxRetry) {
        this.db
          .update(scheduledTasks)
          .set({
            scheduledAt: now + 5000,
            retryCount: nextRetryCount,
            updatedAt: now,
            lastError,
          })
          .where(and(eq(scheduledTasks.id, task.id), eq(scheduledTasks.status, "pending")))
          .run();

        return;
      }

      this.db
        .update(scheduledTasks)
        .set({
          status: "failed",
          retryCount: nextRetryCount,
          updatedAt: now,
          executedAt: now,
          lastError,
        })
        .where(and(eq(scheduledTasks.id, task.id), eq(scheduledTasks.status, "pending")))
        .run();

      await this.createNextRecurringTask(task);
      return;
    }

    this.db
      .update(scheduledTasks)
      .set({
        status: "completed",
        updatedAt: now,
        executedAt: now,
        lastError: null,
      })
      .where(and(eq(scheduledTasks.id, task.id), eq(scheduledTasks.status, "pending")))
      .run();

    await this.createNextRecurringTask(task);
  }

  private async runTask(task: ScheduledTaskRow): Promise<void> {
    await runChatCompletion({
      env: this.env,
      messages: createTaskMessages(task),
      userInfo: {
        userId: task.userId,
      },
      excludeToolNames: ["scheduled_task"],
    });
  }

  private async createNextRecurringTask(task: ScheduledTaskRow): Promise<void> {
    if (!task.cron) {
      return;
    }

    const nextScheduledAt = getNextCronScheduledAt(
      task.cron,
      task.timeZone ?? "UTC",
      task.scheduledAt,
    );

    if (task.recurrenceEndAt !== null && nextScheduledAt > task.recurrenceEndAt) {
      return;
    }

    if (task.maxRuns !== null && task.runNumber >= task.maxRuns) {
      return;
    }

    await this.createTask({
      userId: task.userId,
      type: task.type,
      description: task.description,
      payload: parseTaskPayload(task.payload),
      scheduledAt: nextScheduledAt,
      cron: task.cron,
      timeZone: task.timeZone,
      recurrenceEndAt: task.recurrenceEndAt,
      maxRuns: task.maxRuns,
      runNumber: task.runNumber + 1,
      maxRetry: task.maxRetry,
      retryCount: 0,
    });
  }

  private async scheduleNextAlarm(): Promise<void> {
    const nextTask = this.db
      .select({
        scheduledAt: scheduledTasks.scheduledAt,
      })
      .from(scheduledTasks)
      .where(eq(scheduledTasks.status, "pending"))
      .orderBy(asc(scheduledTasks.scheduledAt), asc(scheduledTasks.createdAt))
      .limit(1)
      .get();

    if (!nextTask) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    await this.ctx.storage.setAlarm(nextTask.scheduledAt);
  }
}
