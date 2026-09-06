import {
  BaseCheckpointSaver,
  copyCheckpoint,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointTuple,
  type LangGraphRunnableConfig as RunnableConfig,
} from "@langchain/langgraph";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { blob, index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import langGraphMigrations from "./migrations/migrations";
import {
  calculateRetryDelay,
  normalizePersistentRetryOptions,
  type PersistentRetryOptions,
} from "./retry-policy";

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

export type DurableLangGraphDb = ReturnType<typeof drizzle<typeof langGraphSchema>>;
export type LangGraphRetry = typeof langGraphRetries.$inferSelect;

type CheckpointListOptions = {
  limit?: number;
  before?: RunnableConfig;
  filter?: Record<string, unknown>;
};
type PendingWrite = [channel: string, value: unknown];

const SPECIAL_WRITE_INDEX: Record<string, number> = {
  __error__: -1,
  __scheduled__: -2,
  __interrupt__: -3,
  __resume__: -4,
};

const configurable = (config: RunnableConfig) => {
  const threadId = config.configurable?.thread_id;
  if (typeof threadId !== "string" || !threadId) {
    throw new Error("LangGraph config requires a non-empty thread_id");
  }
  return {
    threadId,
    checkpointNs: String(config.configurable?.checkpoint_ns ?? ""),
    checkpointId: config.configurable?.checkpoint_id as string | undefined,
  };
};

const bytes = (value: Buffer) => new Uint8Array(value);
const errorMessage = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/** All LangGraph SQLite persistence for one Durable Object. */
export class DurableObjectCheckpointSaver extends BaseCheckpointSaver {
  constructor(private readonly db: DurableLangGraphDb) {
    super();
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const { threadId, checkpointNs, checkpointId } = configurable(config);
    const conditions = [
      eq(langGraphCheckpoints.threadId, threadId),
      eq(langGraphCheckpoints.checkpointNs, checkpointNs),
    ];
    if (checkpointId) conditions.push(eq(langGraphCheckpoints.checkpointId, checkpointId));
    const row = this.db.select().from(langGraphCheckpoints).where(and(...conditions))
      .orderBy(desc(langGraphCheckpoints.checkpointId)).limit(1).get();
    if (!row) return undefined;

    const pendingWrites = await Promise.all(
      this.db.select({
        taskId: langGraphWrites.taskId,
        channel: langGraphWrites.channel,
        value: langGraphWrites.value,
      }).from(langGraphWrites).where(and(
        eq(langGraphWrites.threadId, threadId),
        eq(langGraphWrites.checkpointNs, checkpointNs),
        eq(langGraphWrites.checkpointId, row.checkpointId),
      )).orderBy(asc(langGraphWrites.taskId), asc(langGraphWrites.writeIndex)).all()
        .map(async (write) => [
          write.taskId,
          write.channel,
          await this.serde.loadsTyped("json", bytes(write.value)),
        ] as [string, string, unknown]),
    );

    const tuple: CheckpointTuple = {
      config: { configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: row.checkpointId,
      } },
      checkpoint: await this.serde.loadsTyped("json", bytes(row.checkpoint)),
      metadata: await this.serde.loadsTyped("json", bytes(row.metadata)),
      pendingWrites,
    };
    if (row.parentCheckpointId) {
      tuple.parentConfig = { configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: row.parentCheckpointId,
      } };
    }
    return tuple;
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const { threadId, checkpointNs } = configurable(config);
    const beforeId = options?.before?.configurable?.checkpoint_id as string | undefined;
    const rows = this.db.select({ checkpointId: langGraphCheckpoints.checkpointId })
      .from(langGraphCheckpoints)
      .where(and(
        eq(langGraphCheckpoints.threadId, threadId),
        eq(langGraphCheckpoints.checkpointNs, checkpointNs),
        beforeId ? lt(langGraphCheckpoints.checkpointId, beforeId) : undefined,
      ))
      .orderBy(desc(langGraphCheckpoints.checkpointId))
      .limit(Math.max(0, options?.limit ?? 100))
      .all();

    for (const row of rows) {
      const tuple = await this.getTuple({ configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: row.checkpointId,
      } });
      if (tuple && (!options?.filter || Object.entries(options.filter).every(
        ([key, value]) => (tuple.metadata as Record<string, unknown> | undefined)?.[key] === value,
      ))) yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    const { threadId, checkpointNs, checkpointId } = configurable(config);
    const [[, serializedCheckpoint], [, serializedMetadata]] = await Promise.all([
      this.serde.dumpsTyped(copyCheckpoint(checkpoint)),
      this.serde.dumpsTyped(metadata),
    ]);
    this.db.insert(langGraphCheckpoints).values({
      threadId,
      checkpointNs,
      checkpointId: checkpoint.id,
      parentCheckpointId: checkpointId ?? null,
      checkpoint: Buffer.from(serializedCheckpoint),
      metadata: Buffer.from(serializedMetadata),
    }).onConflictDoUpdate({
      target: [
        langGraphCheckpoints.threadId,
        langGraphCheckpoints.checkpointNs,
        langGraphCheckpoints.checkpointId,
      ],
      set: {
        parentCheckpointId: checkpointId ?? null,
        checkpoint: Buffer.from(serializedCheckpoint),
        metadata: Buffer.from(serializedMetadata),
      },
    }).run();
    return { configurable: {
      thread_id: threadId,
      checkpoint_ns: checkpointNs,
      checkpoint_id: checkpoint.id,
    } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    const { threadId, checkpointNs, checkpointId } = configurable(config);
    if (!checkpointId) throw new Error("LangGraph write requires checkpoint_id");

    for (const [fallbackIndex, [channel, value]] of writes.entries()) {
      const writeIndex = SPECIAL_WRITE_INDEX[channel] ?? fallbackIndex;
      const [, serializedValue] = await this.serde.dumpsTyped(value);
      const insert = this.db.insert(langGraphWrites).values({
        threadId,
        checkpointNs,
        checkpointId,
        taskId,
        writeIndex,
        channel,
        value: Buffer.from(serializedValue),
      });
      if (writeIndex >= 0) insert.onConflictDoNothing().run();
      else insert.onConflictDoUpdate({
        target: [
          langGraphWrites.threadId,
          langGraphWrites.checkpointNs,
          langGraphWrites.checkpointId,
          langGraphWrites.taskId,
          langGraphWrites.writeIndex,
        ],
        set: { channel, value: Buffer.from(serializedValue) },
      }).run();
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    this.db.delete(langGraphWrites).where(eq(langGraphWrites.threadId, threadId)).run();
    this.db.delete(langGraphCheckpoints).where(eq(langGraphCheckpoints.threadId, threadId)).run();
  }
}

export class DurableGraphRetryStore {
  constructor(private readonly db: DurableLangGraphDb) {}

  configure(threadId: string, options: PersistentRetryOptions = {}): void {
    const values = { threadId, ...normalizePersistentRetryOptions(options) };
    this.db.insert(langGraphRetryConfigs).values(values).onConflictDoUpdate({
      target: langGraphRetryConfigs.threadId,
      set: values,
    }).run();
  }

  getOptions(threadId: string): Required<PersistentRetryOptions> {
    const saved = this.db.select().from(langGraphRetryConfigs)
      .where(eq(langGraphRetryConfigs.threadId, threadId)).get();
    return normalizePersistentRetryOptions(saved ?? {});
  }

  get(threadId: string): LangGraphRetry | undefined {
    return this.db.select().from(langGraphRetries)
      .where(eq(langGraphRetries.threadId, threadId)).get();
  }

  getDue(threadId: string, now = Date.now()): LangGraphRetry | undefined {
    const retry = this.get(threadId);
    return retry?.status === "pending" && retry.nextAttemptAt !== null && retry.nextAttemptAt <= now
      ? retry
      : undefined;
  }

  recordFailure(threadId: string, error: unknown): LangGraphRetry {
    const current = this.get(threadId);
    const attemptCount = (current?.attemptCount ?? 0) + 1;
    const configured = this.getOptions(threadId);
    const exhausted = attemptCount >= configured.maxAttempts;
    const now = Date.now();
    const values = {
      threadId,
      status: exhausted ? "exhausted" as const : "pending" as const,
      attemptCount,
      ...configured,
      nextAttemptAt: exhausted ? null : now + calculateRetryDelay(attemptCount, configured),
      lastError: errorMessage(error).slice(0, 4_000),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.db.insert(langGraphRetries).values(values).onConflictDoUpdate({
      target: langGraphRetries.threadId,
      set: values,
    }).run();
    return values;
  }

  clear(threadId: string): void {
    this.db.delete(langGraphRetries).where(eq(langGraphRetries.threadId, threadId)).run();
  }

  exhaust(threadId: string, error: unknown): void {
    const current = this.get(threadId);
    if (!current) return;
    this.db.update(langGraphRetries).set({
      status: "exhausted",
      nextAttemptAt: null,
      lastError: errorMessage(error).slice(0, 4_000),
      updatedAt: Date.now(),
    }).where(eq(langGraphRetries.threadId, threadId)).run();
  }
}

export const createDurableLangGraphSqlite = (storage: DurableObjectStorage) => {
  const db = drizzle(storage, { schema: langGraphSchema });
  return {
    checkpointer: new DurableObjectCheckpointSaver(db),
    retries: new DurableGraphRetryStore(db),
    migrate: () => migrate(db, langGraphMigrations),
  };
};
