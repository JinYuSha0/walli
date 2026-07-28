import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    client: text("client").notNull(),
    summary: text("summary").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_sessions_created_at").on(table.createdAt)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    content: text("content").notNull(),
    inputToken: integer("input_token").notNull(),
    outputToken: integer("output_token").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_messages_session_created_at").on(table.sessionId, table.createdAt),
    index("idx_messages_token_usage").on(table.createdAt, table.inputToken, table.outputToken),
  ],
);

export const messagesFts = sqliteTable("messages_fts", {
  messageId: text("message_id").notNull(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
});

export const scheduledTasks = sqliteTable(
  "scheduled_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    sessionId: text("session_id"),
    payload: text("payload").notNull(),
    systemCreated: integer("system_created").notNull().default(0),
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
  },
  (table) => [index("idx_scheduled_tasks_due").on(table.status, table.scheduledAt)],
);

export const memory = sqliteTable(
  "memory",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["user", "memory"] }).notNull(),
    startMessageId: text("start_message_id").notNull(),
    endMessageId: text("end_message_id").notNull(),
    previousContent: text("previous_content").notNull(),
    updatedContent: text("updated_content").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    check("memory_type_check", sql`${table.type} in ('user', 'memory')`),
    index("idx_memory_type_created_at").on(table.type, table.createdAt),
  ],
);

export const userDoSchema = {
  sessions,
  messages,
  messagesFts,
  scheduledTasks,
  memory,
};
