import { DurableObject } from "cloudflare:workers";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import type { ModelMessage } from "ai";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { createChatUserInfo, runChatCompletion } from "../../lib/chat-runner";
import { createNotificationTools } from "../../tools/tool-notification";
import { getClientUsageLimit } from "../../api/clients";
import { getSettings, isMultiSessionClient } from "../../api/settings";
import { getNextCronScheduledAt } from "../../utils/cron";
import userDoMigrations from "./migrations/migrations";
import { messages, scheduledTasks, sessions, userDoSchema } from "./schema";
import { parseUserDoNotificationChannel } from "./types";
import { sendNotificationText } from "@worker/utils/notification";
export { createUserDoName, parseUserDoNotificationChannel } from "./types";
export type { UserDoClientPlatform, UserDoName, UserNotificationChannel } from "./types";

dayjs.extend(utc);

export type ScheduledTaskStatus = "pending" | "completed" | "failed" | "canceled";
export type ScheduledTaskStatusFilter = ScheduledTaskStatus | "all";

export type ChatSession = {
  id: string;
  client: string;
  summary: string;
  createdAt: number;
};

export type CreateChatSessionInput = {
  id?: string;
  client?: string;
  summary?: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  content: string;
  inputToken: number;
  outputToken: number;
  createdAt: number;
};

export type CreateChatMessageInput = {
  id?: string;
  sessionId: string;
  content: string;
  inputToken?: number;
  outputToken?: number;
  createdAt?: number;
};

export type TokenUsage = {
  inputToken: number;
  outputToken: number;
  totalToken: number;
};

export type ScheduledTask = {
  id: string;
  userId: string;
  type: string;
  description: string;
  payload: unknown;
  systemCreated: boolean;
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
  systemCreated?: boolean;
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
type ChatSessionRow = typeof sessions.$inferSelect;
type ChatMessageRow = typeof messages.$inferSelect;

const SINGLE_SESSION_ID = "single";
const SYSTEM_CONVERSATION_CLEANUP_TASK_TYPE = "system:conversation-cleanup";
const getConversationCleanupRetentionDays = (autoDeletePeriod: string) => {
  switch (autoDeletePeriod) {
    case "day":
      return 1;
    case "week":
      return 7;
    case "month":
      return 30;
    default:
      return undefined;
  }
};

const getStartOfDayAt = (timestamp: number, timeZone: string) => {
  const offsetMinutes = Number(timeZone.slice(3)) * 60;

  return dayjs(timestamp).utcOffset(offsetMinutes).startOf("day").valueOf();
};

const getNextStartOfDayAt = (timestamp: number, timeZone: string) => {
  const offsetMinutes = Number(timeZone.slice(3)) * 60;
  const startOfDay = dayjs(timestamp).utcOffset(offsetMinutes).startOf("day");

  return startOfDay.isAfter(timestamp) ? startOfDay.valueOf() : startOfDay.add(1, "day").valueOf();
};

const toChatSession = (row: ChatSessionRow): ChatSession => ({
  id: row.id,
  client: row.client,
  summary: row.summary,
  createdAt: row.createdAt,
});

const toChatMessage = (row: ChatMessageRow): ChatMessage => ({
  id: row.id,
  sessionId: row.sessionId,
  content: row.content,
  inputToken: row.inputToken,
  outputToken: row.outputToken,
  createdAt: row.createdAt,
});

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
  systemCreated: row.systemCreated === 1,
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

const createTaskFailureNotificationText = (task: ScheduledTaskRow, lastError: string) =>
  [`The scheduled task "${task.description}" failed to execute.`, `Reason: ${lastError}`].join(
    "\n",
  );

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
  const executionInstructions: ModelMessage = {
    role: "user",
    content: [
      "Execute this scheduled task now.",
      "If this task asks to notify, remind, send, or push a message, use the available send_notification tool.",
      'Choose send_notification.type from the task intent: use "voice" for voice/audio/spoken/语音/音频 replies, "image" when an image URL or data URI should be sent, otherwise use "text".',
      'For voice notifications, pass only the human-readable spoken content in send_notification.text; the text-to-speech layer will automatically detect the language and apply the right voice style.',
      "Use the user's requested language and wording when composing the notification.",
      `Task description: ${task.description}`,
      `Task type: ${task.type}`,
      `Task payload: ${task.payload}`,
    ].join("\n"),
  };

  if (typeof payload === "object" && payload !== null && "messages" in payload) {
    const messages = (payload as { messages?: unknown }).messages;

    if (Array.isArray(messages) && messages.length > 0 && messages.every(isScheduledTaskMessage)) {
      return [...messages, executionInstructions];
    }
  }

  return [executionInstructions];
};

export class UserDO extends DurableObject<Env> {
  private readonly db: ReturnType<typeof drizzle<typeof userDoSchema>>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = drizzle(ctx.storage, { schema: userDoSchema });

    ctx.blockConcurrencyWhile(async () => {
      await migrate(this.db, userDoMigrations);

      try {
        await this.createNextConversationCleanupTask();
      } catch (error) {
        console.error(error);
      }
    });
  }

  async createSession(input: CreateChatSessionInput = {}): Promise<ChatSession> {
    const notificationChannel = parseUserDoNotificationChannel(this.ctx.id.name);

    if (notificationChannel && !(await isMultiSessionClient(this.env, notificationChannel.type))) {
      return this.getOrCreateSingleSession(notificationChannel.type, input.summary);
    }

    const now = Date.now();
    const row = this.db
      .insert(sessions)
      .values({
        id: input.id ?? crypto.randomUUID(),
        client: input.client?.trim() || notificationChannel?.type || "unknown",
        summary: input.summary?.trim() ?? "",
        createdAt: now,
      })
      .returning()
      .get();

    return toChatSession(row);
  }

  async listSessions(limit?: number): Promise<ChatSession[]> {
    const orderedQuery = this.db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.createdAt))
      .$dynamic();
    const limitedQuery = limit === undefined ? orderedQuery : orderedQuery.limit(limit);

    return limitedQuery.all().map(toChatSession);
  }

  async addMessages(inputs: CreateChatMessageInput[]): Promise<ChatMessage[]> {
    if (inputs.length === 0) {
      return [];
    }

    const now = Date.now();
    const rows = this.db
      .insert(messages)
      .values(
        inputs.map((input) => ({
          id: input.id ?? crypto.randomUUID(),
          sessionId: input.sessionId,
          content: input.content,
          inputToken: Math.max(0, Math.trunc(input.inputToken ?? 0)),
          outputToken: Math.max(0, Math.trunc(input.outputToken ?? 0)),
          createdAt: input.createdAt ?? now,
        })),
      )
      .returning()
      .all();

    return rows.map(toChatMessage);
  }

  async listRecentMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
    const messageLimit = Math.max(0, Math.trunc(limit));

    if (messageLimit === 0) {
      return [];
    }

    return this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.createdAt))
      .limit(messageLimit)
      .all()
      .map(toChatMessage)
      .reverse();
  }

  async getTokenUsageSince(startAt: number, endAt = Date.now()): Promise<TokenUsage> {
    const row = this.db
      .select({
        inputToken: sql<number>`coalesce(sum(${messages.inputToken}), 0)`,
        outputToken: sql<number>`coalesce(sum(${messages.outputToken}), 0)`,
      })
      .from(messages)
      .where(and(gte(messages.createdAt, startAt), lt(messages.createdAt, endAt)))
      .get();
    const inputToken = Number(row?.inputToken ?? 0);
    const outputToken = Number(row?.outputToken ?? 0);

    return {
      inputToken,
      outputToken,
      totalToken: inputToken + outputToken,
    };
  }

  async getTodayTokenUsage(dayStartAt: number, dayEndAt: number): Promise<TokenUsage> {
    return this.getTokenUsageSince(dayStartAt, dayEndAt);
  }

  async deleteMessagesBefore(cutoffAt: number): Promise<number> {
    const row = this.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .where(lt(messages.createdAt, cutoffAt))
      .get();

    this.db
      .delete(messages)
      .where(lt(messages.createdAt, cutoffAt))
      .run();

    return Number(row?.count ?? 0);
  }

  async deleteConversationDataBefore(cutoffAt: number): Promise<{
    deletedMessageCount: number;
    deletedSessionCount: number;
  }> {
    const deletedMessageCount = await this.deleteMessagesBefore(cutoffAt);
    const emptyOldSessionCondition = and(
      lt(sessions.createdAt, cutoffAt),
      sql`not exists (
        select 1 from ${messages}
        where ${messages.sessionId} = ${sessions.id}
      )`,
    );
    const row = this.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(sessions)
      .where(emptyOldSessionCondition)
      .get();

    this.db.delete(sessions).where(emptyOldSessionCondition).run();

    return {
      deletedMessageCount,
      deletedSessionCount: Number(row?.count ?? 0),
    };
  }

  private getOrCreateSingleSession(client: string, summary?: string): ChatSession {
    const savedSession = this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, SINGLE_SESSION_ID))
      .limit(1)
      .get();

    if (savedSession) {
      return toChatSession(savedSession);
    }

    const row = this.db
      .insert(sessions)
      .values({
        id: SINGLE_SESSION_ID,
        client,
        summary: summary?.trim() ?? "",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    return toChatSession(row);
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
        systemCreated: input.systemCreated ? 1 : 0,
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

  async listTasks(
    status: ScheduledTaskStatusFilter = "pending",
    limit?: number,
  ): Promise<ScheduledTask[]> {
    const taskFilter =
      status === "all"
        ? eq(scheduledTasks.systemCreated, 0)
        : and(eq(scheduledTasks.systemCreated, 0), eq(scheduledTasks.status, status));

    const orderedQuery = this.db
      .select()
      .from(scheduledTasks)
      .where(taskFilter)
      .orderBy(asc(scheduledTasks.scheduledAt), asc(scheduledTasks.createdAt));
    const limitedQuery = limit === undefined ? orderedQuery : orderedQuery.limit(limit);

    return limitedQuery.all().map(toScheduledTask);
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

      if (!this.isSystemConversationCleanupTask(task)) {
        await this.notifyTaskFailure(task, lastError);
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

      if (!this.isSystemConversationCleanupTask(task)) {
        await this.createNextRecurringTask(task);
      }
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

    if (this.isSystemConversationCleanupTask(task)) {
      await this.createNextConversationCleanupTask();
      return;
    }

    await this.createNextRecurringTask(task);
  }

  private async runTask(task: ScheduledTaskRow): Promise<void> {
    if (this.isSystemConversationCleanupTask(task)) {
      await this.runConversationCleanupTask();
      return;
    }

    const notificationChannel = parseUserDoNotificationChannel(this.ctx.id.name);

    await runChatCompletion({
      env: this.env,
      messages: createTaskMessages(task),
      userInfo: notificationChannel
        ? createChatUserInfo({
            userId: task.userId,
            clientPlatform: notificationChannel.type,
            notificationChannel,
          })
        : undefined,
      excludeToolNames: ["scheduled_task"],
      extraTools: createNotificationTools(this.env, notificationChannel),
    });
  }

  private isSystemConversationCleanupTask(task: Pick<ScheduledTaskRow, "type" | "systemCreated">) {
    return task.systemCreated === 1 && task.type === SYSTEM_CONVERSATION_CLEANUP_TASK_TYPE;
  }

  private async runConversationCleanupTask(): Promise<void> {
    const notificationChannel = parseUserDoNotificationChannel(this.ctx.id.name);

    if (!notificationChannel) {
      return;
    }

    const usageLimit = await getClientUsageLimit(this.env.APP_KV, notificationChannel.type);
    const retentionDays = getConversationCleanupRetentionDays(usageLimit.autoDeletePeriod);

    if (retentionDays === undefined) {
      return;
    }

    const settings = await getSettings(this.env.APP_KV);
    const cutoffAt = dayjs(getStartOfDayAt(Date.now(), settings.timeZone))
      .subtract(retentionDays, "day")
      .valueOf();

    await this.deleteConversationDataBefore(cutoffAt);
  }

  private async createNextConversationCleanupTask(): Promise<void> {
    const notificationChannel = parseUserDoNotificationChannel(this.ctx.id.name);

    if (!notificationChannel) {
      return;
    }

    const usageLimit = await getClientUsageLimit(this.env.APP_KV, notificationChannel.type);
    const pendingTask = this.db
      .select({
        id: scheduledTasks.id,
      })
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.status, "pending"),
          eq(scheduledTasks.type, SYSTEM_CONVERSATION_CLEANUP_TASK_TYPE),
          eq(scheduledTasks.systemCreated, 1),
        ),
      )
      .limit(1)
      .get();
    const now = Date.now();

    if (usageLimit.autoDeletePeriod === "never") {
      if (pendingTask) {
        this.db
          .update(scheduledTasks)
          .set({
            status: "canceled",
            updatedAt: now,
            canceledAt: now,
          })
          .where(and(eq(scheduledTasks.id, pendingTask.id), eq(scheduledTasks.status, "pending")))
          .run();
      }

      await this.scheduleNextAlarm();
      return;
    }

    const settings = await getSettings(this.env.APP_KV);
    const scheduledAt = getNextStartOfDayAt(now, settings.timeZone);
    const payload = {
      autoDeletePeriod: usageLimit.autoDeletePeriod,
      timeZone: settings.timeZone,
    };

    if (pendingTask) {
      this.db
        .update(scheduledTasks)
        .set({
          payload: JSON.stringify(payload),
          scheduledAt,
          updatedAt: now,
        })
        .where(and(eq(scheduledTasks.id, pendingTask.id), eq(scheduledTasks.status, "pending")))
        .run();

      await this.scheduleNextAlarm();
      return;
    }

    await this.createTask({
      userId: notificationChannel.userId,
      type: SYSTEM_CONVERSATION_CLEANUP_TASK_TYPE,
      description: "System conversation data cleanup",
      payload,
      systemCreated: true,
      scheduledAt,
      maxRetry: 1,
    });
  }

  private async notifyTaskFailure(task: ScheduledTaskRow, lastError: string): Promise<void> {
    const notificationChannel = parseUserDoNotificationChannel(this.ctx.id.name);

    if (!notificationChannel) {
      return;
    }

    const message = createTaskFailureNotificationText(task, lastError);

    try {
      await sendNotificationText(this.env, notificationChannel, message);
    } catch (error) {
      console.error(error);
    }
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
