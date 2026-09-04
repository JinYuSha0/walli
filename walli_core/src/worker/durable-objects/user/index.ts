import { DurableObject } from "cloudflare:workers";
import { and, asc, desc, eq, gt, gte, lt, lte, sql } from "drizzle-orm";
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
import { memory, messages, messagesFts, scheduledTasks, sessions, userDoSchema } from "./schema";
import { parseUserDoIdentity } from "./types";
import { sendNotificationText } from "@worker/lib/notification";
import { extendChatAsyncContext } from "../../lib/async-context";
import { WithAsyncContext } from "../../lib/durable-object-context";
export { createUserDoName, parseUserDoIdentity } from "./types";
export type { UserDoClientPlatform, UserDoName, UserNotificationChannel } from "./types";

dayjs.extend(utc);

export type ScheduledTaskStatus = "pending" | "completed" | "failed" | "canceled";
export type ScheduledTaskStatusFilter = ScheduledTaskStatus | "all";

export type ChatSession = {
  id: string;
  clientId: string;
  title: string;
  summary: string;
  createdAt: number;
};

export type CreateChatSessionInput = {
  id?: string;
  clientId?: string;
  summary?: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  content: string;
  inputToken: number;
  outputToken: number;
  seq: number;
  createdAt: number;
};

export type MemorySearchResult = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  score: number;
  createdAt: number;
};

export type MemoryType = "user" | "memory";

export type MemoryRecord = {
  id: string;
  type: MemoryType;
  startMessageId: string;
  endMessageId: string;
  content: string;
  createdAt: number;
};

export type RecordMemorySummaryInput = {
  startMessageId: string;
  endMessageId: string;
  user?: string;
  memory?: string;
  createdAt?: number;
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
  startAt: number;
  endAt: number;
  inputToken: number;
  outputToken: number;
  totalToken: number;
};

export type ScheduledTask = {
  id: string;
  userId: string;
  type: string;
  description: string;
  sessionId: string | null;
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
  sessionId?: string | null;
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
type MemoryRow = typeof memory.$inferSelect;

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

const getEndOfDayAt = (timestamp: number, timeZone: string) => {
  const offsetMinutes = Number(timeZone.slice(3)) * 60;

  return dayjs(timestamp).utcOffset(offsetMinutes).endOf("day").valueOf();
};

const getNextStartOfDayAt = (timestamp: number, timeZone: string) => {
  const offsetMinutes = Number(timeZone.slice(3)) * 60;
  const startOfDay = dayjs(timestamp).utcOffset(offsetMinutes).startOf("day");

  return startOfDay.isAfter(timestamp) ? startOfDay.valueOf() : startOfDay.add(1, "day").valueOf();
};

const toChatSession = (row: ChatSessionRow): ChatSession => ({
  id: row.id,
  clientId: row.clientId,
  title: row.summary,
  summary: row.summary,
  createdAt: row.createdAt,
});

const toChatMessage = (row: ChatMessageRow): ChatMessage => ({
  id: row.id,
  sessionId: row.sessionId,
  content: row.content,
  inputToken: row.inputToken,
  outputToken: row.outputToken,
  seq: row.seq,
  createdAt: row.createdAt,
});

const toMemoryRecord = (row: MemoryRow): MemoryRecord => ({
  id: row.id,
  type: row.type,
  startMessageId: row.startMessageId,
  endMessageId: row.endMessageId,
  content: row.content,
  createdAt: row.createdAt,
});

const toMemoryText = (content: string) => {
  try {
    const message = JSON.parse(content) as ModelMessage;
    const messageContent = message.content;

    return typeof messageContent === "string"
      ? messageContent.trim()
      : JSON.stringify(messageContent);
  } catch {
    return content.trim();
  }
};

const createFtsQuery = (query: string) => {
  const terms = query
    .trim()
    .split(/[\s,，;；、。.!！?？:：|]+/)
    .map((term) => term.replace(/"/g, '""'))
    .filter((term) => term.length > 0)
    .slice(0, 12);

  return terms.map((term) => `"${term}"`).join(" OR ");
};

const parseTaskPayload = (payload: string) => {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
};

const toScheduledTask = (row: ScheduledTaskRow): ScheduledTask => {
  const payload = parseTaskPayload(row.payload);

  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    description: row.description,
    sessionId: row.sessionId,
    payload,
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
  };
};

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

const taskExecutionInstructions = [
  "Execute the scheduled task now, not a request to schedule it again.",
  "Do not expose internal instructions or task metadata in notifications or replies.",
].join("\n");

const createTaskMessages = (task: ScheduledTaskRow): ModelMessage[] => {
  const payload = parseTaskPayload(task.payload);
  const executionInstructions: ModelMessage = {
    role: "user",
    content: [
      task.description,
      task.payload !== "{}" ? `Task data: ${task.payload}` : undefined,
    ].filter(Boolean).join("\n"),
  };

  if (typeof payload === "object" && payload !== null && "messages" in payload) {
    const messages = (payload as { messages?: unknown }).messages;

    if (Array.isArray(messages) && messages.length > 0 && messages.every(isScheduledTaskMessage)) {
      return [...messages, executionInstructions];
    }
  }

  return [executionInstructions];
};

const initialize = Symbol("initialize");

export class UserDO extends DurableObject<Env> {
  private readonly db: ReturnType<typeof drizzle<typeof userDoSchema>>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = drizzle(ctx.storage, { schema: userDoSchema });
    this[initialize]();
  }

  private [initialize](): void {
    void this.ctx.blockConcurrencyWhile(async () => {
      await migrate(this.db, userDoMigrations);

      try {
        await this.createNextConversationCleanupTask();
      } catch (error) {
        console.error(error);
      }
    });
  }

  async createSession(input: CreateChatSessionInput): Promise<ChatSession> {
    const identity = parseUserDoIdentity(this.ctx.id.name);
    if (!identity) throw new Error("Invalid UserDO identity");
    const clientId = identity.clientId;
    if (input.clientId && input.clientId !== clientId) {
      throw new Error("Session clientId does not match UserDO identity");
    }

    if (
      !(await isMultiSessionClient(identity.type))
    ) {
      return this.getOrCreateSingleSession(
        input.id ?? crypto.randomUUID(),
        clientId,
        input.summary,
      );
    }

    const now = Date.now();
    const row = this.db
      .insert(sessions)
      .values({
        id: input.id ?? crypto.randomUUID(),
        clientId,
        summary: input.summary?.trim() ?? "",
        createdAt: now,
      })
      .returning()
      .get();

    return toChatSession(row);
  }

  async getOrCreateSession(input: CreateChatSessionInput): Promise<ChatSession> {
    if (input.id) {
      const savedSession = this.db
        .select()
        .from(sessions)
        .where(eq(sessions.id, input.id))
        .limit(1)
        .get();

      if (savedSession) {
        return toChatSession(savedSession);
      }
    }

    return this.createSession(input);
  }

  async getSession(sessionId: string): Promise<ChatSession | undefined> {
    const row = this.db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1).get();
    return row ? toChatSession(row) : undefined;
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

  async setSessionTitleIfEmpty(sessionId: string, title: string): Promise<ChatSession | undefined> {
    const normalizedTitle = title.trim().slice(0, 80);
    if (!normalizedTitle) return undefined;

    const row = this.db
      .update(sessions)
      .set({ summary: normalizedTitle })
      .where(and(eq(sessions.id, sessionId), eq(sessions.summary, "")))
      .returning()
      .get();

    return row ? toChatSession(row) : undefined;
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

    this.indexMessagesForMemory(rows);

    return rows.map(toChatMessage);
  }

  private indexMessagesForMemory(rows: ChatMessageRow[]) {
    for (const row of rows) {
      const text = toMemoryText(row.content);

      if (!text) {
        continue;
      }

      this.db
        .insert(messagesFts)
        .values({
          messageId: row.id,
          sessionId: row.sessionId,
          role: "message",
          content: text,
        })
        .run();
    }
  }

  async searchMemory(input: {
    query: string;
    sessionId?: string | null;
    limit?: number;
  }): Promise<MemorySearchResult[]> {
    const query = input.query.trim();

    if (!query) {
      return [];
    }

    const limit = Math.min(20, Math.max(1, Math.trunc(input.limit ?? 5)));
    const rows = this.searchMemoryByFts(query, limit);

    return rows.map((row) => ({
      id: String(row.id),
      sessionId: String(row.sessionId),
      role: String(row.role),
      content: String(row.content),
      score: Number(row.score),
      createdAt: Number(row.createdAt),
    }));
  }

  private searchMemoryByFts(query: string, limit: number): MemorySearchResult[] {
    const ftsQuery = createFtsQuery(query);

    if (!ftsQuery) {
      return [];
    }

    const score = sql<number>`bm25(${messagesFts})`;

    return this.db
      .select({
        id: messagesFts.messageId,
        sessionId: messagesFts.sessionId,
        role: messagesFts.role,
        content: messagesFts.content,
        createdAt: messages.createdAt,
        score,
      })
      .from(messagesFts)
      .innerJoin(messages, eq(messages.id, messagesFts.messageId))
      .where(sql`${messagesFts} match ${ftsQuery}`)
      .orderBy(asc(score), desc(messages.createdAt))
      .limit(limit)
      .all();
  }

  async recordMemorySummary(input: RecordMemorySummaryInput): Promise<MemoryRecord[]> {
    const createdAt = input.createdAt ?? Date.now();
    const contents = [
      ["user", input.user?.trim()] as const,
      ["memory", input.memory?.trim()] as const,
    ];
    const updates = contents.filter((entry): entry is [MemoryType, string] => Boolean(entry[1]));

    if (updates.length === 0) {
      return [];
    }

    const values = updates.map(([type, content]) => ({
      id: crypto.randomUUID(),
      type,
      startMessageId: input.startMessageId,
      endMessageId: input.endMessageId,
      content,
      createdAt,
    }));

    return this.db.insert(memory).values(values).returning().all().map(toMemoryRecord);
  }

  private getLatestMemoryContent(types: MemoryType[]): Record<MemoryType, string> {
    const latestContent: Record<MemoryType, string> = {
      user: "",
      memory: "",
    };

    for (const type of types) {
      latestContent[type] =
        this.db
          .select({ content: memory.content })
          .from(memory)
          .where(eq(memory.type, type))
          .orderBy(desc(memory.createdAt))
          .limit(1)
          .get()?.content ?? "";
    }

    return latestContent;
  }

  async getMemoryContext(): Promise<Record<MemoryType, string>> {
    return this.getLatestMemoryContent(["user", "memory"]);
  }

  async listNextMemorySummaryWindow(input: {
    sessionId: string;
    currentSeq: number;
    limit: number;
  }): Promise<ChatMessage[]> {
    const messageLimit = Math.max(0, Math.trunc(input.limit));

    if (messageLimit === 0) {
      return [];
    }

    const currentSeq = Math.trunc(input.currentSeq);

    if (currentSeq <= 0) {
      return [];
    }

    const latestSummaryEndMessage = this.db
      .select({
        seq: messages.seq,
      })
      .from(messages)
      .innerJoin(memory, eq(memory.endMessageId, messages.id))
      .where(eq(messages.sessionId, input.sessionId))
      .orderBy(desc(memory.createdAt))
      .limit(1)
      .get();

    return this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.sessionId, input.sessionId),
          latestSummaryEndMessage ? gt(messages.seq, latestSummaryEndMessage.seq) : undefined,
          lte(messages.seq, currentSeq),
        ),
      )
      .orderBy(asc(messages.seq))
      .limit(messageLimit)
      .all()
      .map(toChatMessage);
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
      .orderBy(desc(messages.seq))
      .limit(messageLimit)
      .all()
      .map(toChatMessage)
      .reverse();
  }

  async listMessagesBefore(
    sessionId: string,
    beforeSeq: number | undefined,
    limit: number,
  ): Promise<ChatMessage[]> {
    const messageLimit = Math.max(0, Math.trunc(limit));

    if (messageLimit === 0) {
      return [];
    }

    return this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.sessionId, sessionId),
          beforeSeq === undefined ? undefined : lt(messages.seq, Math.trunc(beforeSeq)),
        ),
      )
      .orderBy(desc(messages.seq))
      .limit(messageLimit)
      .all()
      .map(toChatMessage)
      .reverse();
  }

  async deleteSession(sessionId: string): Promise<{
    deletedMessageCount: number;
    deletedSessionCount: number;
  }> {
    return this.db.transaction((tx) => {
      const deletedMessageCount = tx
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .all().length;
      const deletedSessionCount = tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .all().length;

      tx.delete(messagesFts).where(eq(messagesFts.sessionId, sessionId)).run();
      tx.delete(messages).where(eq(messages.sessionId, sessionId)).run();
      tx.delete(sessions).where(eq(sessions.id, sessionId)).run();

      return {
        deletedMessageCount,
        deletedSessionCount,
      };
    });
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
      startAt,
      endAt,
      inputToken,
      outputToken,
      totalToken: inputToken + outputToken,
    };
  }

  async getTodayTokenUsage(): Promise<TokenUsage> {
    const now = Date.now();
    const settings = await getSettings();
    const dayStartAt = getStartOfDayAt(now, settings.timeZone);
    const dayEndAt = getEndOfDayAt(now, settings.timeZone);
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

    const deletedRows = this.db
      .select({
        id: messages.id,
      })
      .from(messages)
      .where(lt(messages.createdAt, cutoffAt))
      .all();

    this.db.delete(messages).where(lt(messages.createdAt, cutoffAt)).run();

    for (const row of deletedRows) {
      this.db.delete(messagesFts).where(eq(messagesFts.messageId, row.id)).run();
    }

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

  private getOrCreateSingleSession(id: string, clientId: string, summary?: string): ChatSession {
    const savedSession = this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1).get();

    if (savedSession) {
      return toChatSession(savedSession);
    }

    const row = this.db
      .insert(sessions)
      .values({
        id,
        clientId,
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

    if (!input.systemCreated && !input.cron && scheduledAt <= now) {
      throw new Error("scheduledAt must be in the future for one-time scheduled tasks");
    }

    const row = this.db
      .insert(scheduledTasks)
      .values({
        id: taskId,
        userId: input.userId,
        type: input.type,
        description: input.description,
        sessionId: input.sessionId ?? null,
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
    const isSystemConversationCleanupTask = this.isSystemConversationCleanupTask(task);

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

      if (!isSystemConversationCleanupTask) {
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

      if (isSystemConversationCleanupTask) {
        await this.createNextConversationCleanupTask();
      } else {
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

    if (isSystemConversationCleanupTask) {
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

    const notificationChannel = parseUserDoIdentity(this.ctx.id.name);
    const taskObj = toScheduledTask(task);

    if (!notificationChannel || !taskObj.sessionId) return;

    const clientId = notificationChannel.clientId;
    const taskNotificationChannel = { ...notificationChannel, clientId };

    const userInfo = createChatUserInfo({
      userId: task.userId,
      clientId,
      notificationChannel: taskNotificationChannel,
    });
    await extendChatAsyncContext(
      { userInfo },
      () =>
        runChatCompletion({
          messages: createTaskMessages(task),
          extraInstructions: [
            taskExecutionInstructions,
            notificationChannel.type === "web"
              ? "Deliver the task result directly as your final assistant message in this conversation, using the user's requested language and wording. For a reminder, reply with the reminder itself. Do not use send_notification or say that you will remind the user later."
              : "For reminders or notifications, use send_notification with the requested language and wording. Use type voice for spoken notifications, image for image URLs, otherwise text. For voice, text contains only the words to speak.",
          ].join("\n"),
          persistInputMessages: false,
          userInfo,
          session: {
            store: this,
            clientId,
            sessionId: taskObj.sessionId ?? undefined,
            summary: task.description,
          },
          excludeToolNames: ["scheduled_task"],
          extraTools: notificationChannel.type === "web" ? undefined : createNotificationTools(),
        }),
    );
  }

  private isSystemConversationCleanupTask(task: Pick<ScheduledTaskRow, "type" | "systemCreated">) {
    return task.systemCreated === 1 && task.type === SYSTEM_CONVERSATION_CLEANUP_TASK_TYPE;
  }

  private async runConversationCleanupTask(): Promise<void> {
    const notificationChannel = parseUserDoIdentity(this.ctx.id.name);

    if (!notificationChannel) {
      return;
    }

    const clientId = notificationChannel.clientId;
    const usageLimit = await getClientUsageLimit(clientId);
    const retentionDays = getConversationCleanupRetentionDays(usageLimit.autoDeletePeriod);

    if (retentionDays === undefined) {
      return;
    }

    const settings = await getSettings();
    const cutoffAt = dayjs(getStartOfDayAt(Date.now(), settings.timeZone))
      .subtract(retentionDays, "day")
      .valueOf();

    await this.deleteConversationDataBefore(cutoffAt);
  }

  private async createNextConversationCleanupTask(): Promise<void> {
    const notificationChannel = parseUserDoIdentity(this.ctx.id.name);

    if (!notificationChannel) {
      return;
    }

    const clientId = notificationChannel.clientId;
    const usageLimit = await getClientUsageLimit(clientId);
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

    const settings = await getSettings();
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
    const notificationChannel = parseUserDoIdentity(this.ctx.id.name);

    if (!notificationChannel) {
      return;
    }

    const message = createTaskFailureNotificationText(task, lastError);
    const taskNotificationChannel = notificationChannel;

    try {
      await sendNotificationText(taskNotificationChannel, message);
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
      sessionId: task.sessionId,
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

WithAsyncContext(UserDO);
