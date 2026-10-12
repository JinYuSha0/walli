import {
  and,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";
import { dataset, datasetRecord, datasetSearchJob } from "../db/schema";
import { getAsyncContext } from "../lib/async-context";
import { datasetDb } from "./store";

type Job = typeof datasetSearchJob.$inferSelect;
const notFound = (error: unknown) =>
  error instanceof Error &&
  (error.name === "AiSearchNotFoundError" ||
    // Binding RPC can serialize the provider error into a plain Error.
    /^AiSearchNotFoundError: ai_search_not_found(?:\s|$)/.test(error.message));

async function instanceFor(name: string, create: boolean) {
  const binding = getAsyncContext().env.DATASET_SEARCH;
  if (!binding) throw new Error("AI Search binding is unavailable");
  const instance = binding.get(name);
  try {
    await instance.info();
  } catch (error) {
    if (!notFound(error)) throw error;
    if (!create) return null;
    try {
      return await binding.create({
        id: name,
        index_method: { vector: true, keyword: true },
        indexing_options: { keyword_tokenizer: "trigram" },
        cache: false,
        public_endpoint_params: { enabled: false },
      });
    } catch (creationError) {
      // Concurrent jobs may have provisioned the same server-owned instance.
      try {
        await instance.info();
      } catch {
        throw creationError;
      }
    }
  }
  // Enforce private instance endpoints before uploading any data.
  await instance.update({ public_endpoint_params: { enabled: false } });
  return instance;
}

async function processJob(job: Job, token: string) {
  const db = datasetDb();
  const finish = async (
    status: string,
    itemId: string | null,
    delay = 0,
    error: string | null = null,
  ) => {
    // A concurrent edit/delete must never let this worker mark an obsolete revision ready.
    const currentRevision = db
      .select({ id: datasetRecord.id })
      .from(datasetRecord)
      .innerJoin(dataset, eq(dataset.id, datasetRecord.datasetId))
      .where(
        and(
          eq(datasetRecord.id, datasetSearchJob.recordId),
          eq(datasetRecord.revision, datasetSearchJob.revision),
          isNull(datasetRecord.deletedAt),
          eq(datasetRecord.enabled, true),
          isNull(dataset.deletedAt),
        ),
      );
    await db
      .update(datasetSearchJob)
      .set({
        status: sql`case when ${status} = 'ready' and not exists ${currentRevision} then 'pending' else ${status} end`,
        itemId,
        nextAttemptAt: Date.now() + delay,
        leaseToken: null,
        leaseUntil: 0,
        error,
      })
      .where(and(eq(datasetSearchJob.id, job.id), eq(datasetSearchJob.leaseToken, token)));
  };
  try {
    const source = await db
      .select({
        instanceName: dataset.instanceName,
        enabled: datasetRecord.enabled,
        title: datasetRecord.title,
        dataJson: datasetRecord.dataJson,
        revision: datasetRecord.revision,
        deletedAt: datasetRecord.deletedAt,
        datasetDeleted: dataset.deletedAt,
      })
      .from(datasetRecord)
      .innerJoin(dataset, eq(dataset.id, datasetRecord.datasetId))
      .where(and(eq(datasetRecord.id, job.recordId), eq(datasetRecord.datasetId, job.datasetId)))
      .get();
    if (!source) throw new Error("Sync source is missing");
    const obsolete =
      !source.enabled ||
      source.deletedAt !== null ||
      source.datasetDeleted !== null ||
      source.revision !== job.revision;
    const instance = await instanceFor(source.instanceName, !obsolete);
    if (!instance) {
      await finish("deleted", null);
      return;
    }
    let itemId = job.itemId;
    if (!itemId) {
      // Recover an upload whose response was lost. Keys are immutable per revision.
      const existing = await instance.items.list({ search: job.itemKey, per_page: 50 });
      itemId = existing.result.find((item) => item.key === job.itemKey)?.id ?? null;
    }
    if (obsolete) {
      if (itemId) {
        try {
          await instance.items.delete(itemId);
        } catch (error) {
          if (!notFound(error)) throw error;
        }
      }
      await finish("deleted", itemId);
      return;
    }
    if (!itemId) {
      const data = JSON.parse(source.dataJson) as Record<string, unknown>;
      const content = `# ${source.title}\n\n${Object.entries(data)
        .map(
          ([key, value]) =>
            `## ${key}\n\n${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`,
        )
        .join("\n\n")}`;
      const item = await instance.items.upload(job.itemKey, content);
      itemId = item.id;
      // Persist the remote identity before polling or any further remote operation.
      await db
        .update(datasetSearchJob)
        .set({ itemId })
        .where(and(eq(datasetSearchJob.id, job.id), eq(datasetSearchJob.leaseToken, token)));
    }
    let info: AiSearchItemInfo;
    try {
      info = await instance.items.get(itemId).info();
    } catch (error) {
      if (!notFound(error)) throw error;
      await finish("pending", null, 60000);
      return;
    }
    if (info.status === "completed") await finish("ready", itemId);
    else if (info.status === "error" || info.status === "skipped" || info.status === "outdated") {
      await instance.items.get(itemId).sync();
      await finish(
        "error",
        itemId,
        Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
        "AI Search indexing failed; retry scheduled",
      );
    } else await finish("indexing", itemId, 60000);
  } catch (error) {
    // Do not persist provider errors that could include source content or credentials.
    console.error("Dataset search synchronization failed", {
      jobId: job.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    const current = await db
      .select({ itemId: datasetSearchJob.itemId })
      .from(datasetSearchJob)
      .where(eq(datasetSearchJob.id, job.id))
      .get();
    await finish(
      "error",
      current?.itemId ?? null,
      Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
      "AI Search synchronization failed; retry scheduled",
    );
  }
}

export type DatasetSyncMessage =
  { type: "dataset"; datasetId: string; after?: string } | { type: "job"; jobId: string };

export async function enqueueDatasetSync(datasetId: string) {
  await getAsyncContext().env.DATASET_SYNC_QUEUE.send({ type: "dataset", datasetId });
}

// Local Queue deliveries can disappear when the development runtime restarts.
// Recover only due pending/indexing jobs; never reset provider error retry budgets.
export async function recoverDevelopmentSync(datasetId: string) {
  const now = Date.now();
  const jobs = await datasetDb()
    .select({ id: datasetSearchJob.id })
    .from(datasetSearchJob)
    .where(
      and(
        eq(datasetSearchJob.datasetId, datasetId),
        inArray(datasetSearchJob.status, ["pending", "indexing"]),
        lte(datasetSearchJob.nextAttemptAt, now),
        lt(datasetSearchJob.leaseUntil, now),
      ),
    )
    .orderBy(datasetSearchJob.id)
    .limit(50);
  if (jobs.length)
    await getAsyncContext().env.DATASET_SYNC_QUEUE.sendBatch(
      jobs.map(({ id }) => ({ body: { type: "job" as const, jobId: id } })),
    );
}

async function consumeMessage(message: Message<DatasetSyncMessage>) {
  const db = datasetDb();
  const queue = getAsyncContext().env.DATASET_SYNC_QUEUE;
  const body = message.body;
  if (body.type === "dataset") {
    const source = await db
      .select({ instanceName: dataset.instanceName, deletedAt: dataset.deletedAt })
      .from(dataset)
      .where(eq(dataset.id, body.datasetId))
      .get();
    if (!source) {
      message.ack();
      return;
    }
    if (source.deletedAt !== null) {
      // Let already-running uploads finish before deleting the entire instance.
      const active = await db
        .select({ id: datasetSearchJob.id })
        .from(datasetSearchJob)
        .where(
          and(
            eq(datasetSearchJob.datasetId, body.datasetId),
            gt(datasetSearchJob.leaseUntil, Date.now()),
          ),
        )
        .limit(1)
        .get();
      if (active) {
        await queue.send({ type: "dataset", datasetId: body.datasetId }, { delaySeconds: 60 });
        message.ack();
        return;
      }
      const binding = getAsyncContext().env.DATASET_SEARCH;
      if (!binding) throw new Error("AI Search binding is unavailable");
      try {
        await binding.delete(source.instanceName);
      } catch (error) {
        if (!notFound(error)) throw error;
      }
      // Foreign-key cascades remove records, models, schema versions, grants, and jobs atomically.
      await db
        .delete(dataset)
        .where(and(eq(dataset.id, body.datasetId), isNotNull(dataset.deletedAt)));
      message.ack();
      return;
    }

    // Page through the durable outbox, including cleanup for deleted datasets.
    const results = await db
      .select({ id: datasetSearchJob.id })
      .from(datasetSearchJob)
      .where(
        and(
          eq(datasetSearchJob.datasetId, body.datasetId),
          gt(datasetSearchJob.id, body.after ?? ""),
          notInArray(datasetSearchJob.status, ["ready", "deleted"]),
        ),
      )
      .orderBy(datasetSearchJob.id)
      .limit(50);
    if (results.length) {
      await queue.sendBatch(results.map(({ id }) => ({ body: { type: "job", jobId: id } })));
      if (results.length === 50)
        await queue.send({ type: "dataset", datasetId: body.datasetId, after: results.at(-1)!.id });
    }
    message.ack();
    return;
  }
  if (body.type !== "job" || typeof body.jobId !== "string")
    throw new Error("Invalid dataset synchronization message");
  const token = crypto.randomUUID();
  const now = Date.now();
  const job = await db
    .update(datasetSearchJob)
    .set({
      leaseToken: token,
      leaseUntil: now + 300000,
      attempts: sql`${datasetSearchJob.attempts} + 1`,
    })
    .where(
      and(
        eq(datasetSearchJob.id, body.jobId),
        exists(
          db
            .select({ id: dataset.id })
            .from(dataset)
            .where(and(eq(dataset.id, datasetSearchJob.datasetId), isNull(dataset.deletedAt))),
        ),
        lt(datasetSearchJob.leaseUntil, now),
        lte(datasetSearchJob.nextAttemptAt, now),
        notInArray(datasetSearchJob.status, ["ready", "deleted"]),
      ),
    )
    .returning()
    .get();
  if (job) await processJob(job, token);
  const state = await db
    .select({
      status: datasetSearchJob.status,
      nextAttemptAt: datasetSearchJob.nextAttemptAt,
      leaseUntil: datasetSearchJob.leaseUntil,
      datasetDeleted: dataset.deletedAt,
    })
    .from(datasetSearchJob)
    .innerJoin(dataset, eq(dataset.id, datasetSearchJob.datasetId))
    .where(eq(datasetSearchJob.id, body.jobId))
    .get();
  if (
    !state ||
    state.datasetDeleted !== null ||
    state.status === "ready" ||
    state.status === "deleted"
  ) {
    message.ack();
    return;
  }
  const delaySeconds = Math.max(
    1,
    Math.ceil((Math.max(state.nextAttemptAt, state.leaseUntil) - Date.now()) / 1000),
  );
  if (state.status === "error") {
    // Provider failures consume the Queue retry budget and eventually reach the DLQ.
    message.retry({ delaySeconds });
    return;
  }
  // Normal indexing waits do not consume retries. Publish before acknowledging.
  await queue.send(body, { delaySeconds });
  message.ack();
}

export async function consumeDatasetSync(batch: MessageBatch<DatasetSyncMessage>) {
  for (const message of batch.messages) {
    try {
      await consumeMessage(message);
    } catch (error) {
      console.error("Dataset queue delivery failed", {
        messageId: message.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      message.retry({ delaySeconds: 60 });
    }
  }
}
