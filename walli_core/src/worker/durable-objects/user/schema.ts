import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const scheduledTasks = sqliteTable(
  "scheduled_tasks",
  {
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
  },
  (table) => [
    index("idx_scheduled_tasks_due").on(table.status, table.scheduledAt),
  ],
);

export const userDoSchema = {
  scheduledTasks,
};
