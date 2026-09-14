import { blob, index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const langGraphCheckpoints = sqliteTable(
  "langgraph_checkpoints",
  {
    threadId: text("thread_id").notNull(),
    checkpointNs: text("checkpoint_ns").notNull(),
    checkpointId: text("checkpoint_id").notNull(),
    parentCheckpointId: text("parent_checkpoint_id"),
    checkpoint: blob("checkpoint", { mode: "buffer" }).notNull(),
    metadata: blob("metadata", { mode: "buffer" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.threadId, table.checkpointNs, table.checkpointId] }),
    index("idx_langgraph_checkpoints_latest").on(
      table.threadId,
      table.checkpointNs,
      table.checkpointId,
    ),
  ],
);

export const langGraphWrites = sqliteTable(
  "langgraph_checkpoint_writes",
  {
    threadId: text("thread_id").notNull(),
    checkpointNs: text("checkpoint_ns").notNull(),
    checkpointId: text("checkpoint_id").notNull(),
    taskId: text("task_id").notNull(),
    writeIndex: integer("write_index").notNull(),
    channel: text("channel").notNull(),
    value: blob("value", { mode: "buffer" }).notNull(),
  },
  (table) => [primaryKey({ columns: [
    table.threadId,
    table.checkpointNs,
    table.checkpointId,
    table.taskId,
    table.writeIndex,
  ] })],
);

export const langGraphRetries = sqliteTable(
  "langgraph_retries",
  {
    threadId: text("thread_id").primaryKey(),
    status: text("status", { enum: ["pending", "exhausted"] }).notNull(),
    attemptCount: integer("attempt_count").notNull(),
    maxAttempts: integer("max_attempts").notNull(),
    initialInterval: integer("initial_interval").notNull(),
    backoffFactor: real("backoff_factor").notNull(),
    maxInterval: integer("max_interval").notNull(),
    jitter: integer("jitter", { mode: "boolean" }).notNull(),
    nextAttemptAt: integer("next_attempt_at"),
    lastError: text("last_error").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_langgraph_retries_due").on(table.status, table.nextAttemptAt)],
);

export const langGraphRetryConfigs = sqliteTable("langgraph_retry_configs", {
  threadId: text("thread_id").primaryKey(),
  maxAttempts: integer("max_attempts").notNull(),
  initialInterval: integer("initial_interval").notNull(),
  backoffFactor: real("backoff_factor").notNull(),
  maxInterval: integer("max_interval").notNull(),
  jitter: integer("jitter", { mode: "boolean" }).notNull(),
});

export const langGraphSchema = {
  langGraphCheckpoints,
  langGraphRetryConfigs,
  langGraphRetries,
  langGraphWrites,
};

