import { and, desc, eq, exists, inArray, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import {
  client,
  clientDataset,
  dataset,
  datasetCategory,
  datasetSchema,
  datasetRecord,
  datasetSearchJob,
} from "../db/schema";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { validator } from "hono/validator";
import { z } from "zod";
import {
  categoryInput,
  categoryUpdate,
  datasetInput,
  recordInput,
  recordUpdate,
  validateData,
  type DataSchema,
} from "@shared/datasets";
import {
  datasetColumns,
  insertModel,
  insertModelSchema,
  datasetDb,
  enqueueRecord,
  getCategories,
  getRecordModel,
  getDataset,
  wakeOldJobs,
} from "../datasets/store";
import { enqueueDatasetSync, recoverDevelopmentSync } from "../datasets/sync";
import type { AppBindings } from "./types";
import { requireAdmin } from "./helper/middleware";

const validate = <T extends z.ZodType>(schema: T) =>
  validator("json", (value, c) => {
    const result = schema.safeParse(value);
    return result.success
      ? result.data
      : c.json({ error: "Invalid input", details: result.error.issues }, 400);
  });
async function kickSync(datasetId: string) {
  try {
    await enqueueDatasetSync(datasetId);
  } catch {
    // D1 and Queue do not share a transaction. Keep the outbox and report this explicitly.
    throw new HTTPException(503, {
      res: Response.json(
        {
          error:
            "Data saved, but synchronization could not be queued. Retry synchronization; do not repeat the write.",
          persisted: true,
          retryUrl: `/api/admin/datasets/${datasetId}/sync`,
        },
        { status: 503 },
      ),
    });
  }
}
const recordColumns = {
  enabled: datasetRecord.enabled,
  id: datasetRecord.id,
  datasetId: datasetRecord.datasetId,
  categoryId: datasetRecord.categoryId,
  schemaVersion: datasetRecord.schemaVersion,
  title: datasetRecord.title,
  dataJson: datasetRecord.dataJson,
  revision: datasetRecord.revision,
  updatedAt: datasetRecord.updatedAt,
  syncStatus: sql<string>`coalesce(${datasetSearchJob.status}, 'pending')`.as("syncStatus"),
  syncError: datasetSearchJob.error,
};
// JSON membership keeps large binding lists within D1's parameter budget.
const jsonIds = (ids: string[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;
const currentModel = (id: string, datasetId: string, version: number) =>
  and(
    eq(datasetCategory.id, id),
    eq(datasetCategory.datasetId, datasetId),
    eq(datasetCategory.version, version),
    isNull(datasetCategory.archivedAt),
  );

export const datasetsRoute = new Hono<AppBindings>()
  .use("/api/admin/clients/:clientId/datasets", requireAdmin)
  .use("/api/admin/clients/:clientId/datasets", bodyLimit({ maxSize: 64 * 1024 }))
  .use("/api/admin/clients/:clientId/datasets", async (c, next) => {
    if (
      !(await datasetDb()
        .select({ id: client.id })
        .from(client)
        .where(eq(client.id, c.req.param("clientId")))
        .get())
    )
      return c.json({ error: "Client not found" }, 404);
    await next();
  })
  .get("/api/admin/clients/:clientId/datasets", async (c) => {
    const rows = await datasetDb()
      .select({ datasetId: clientDataset.datasetId })
      .from(clientDataset)
      .innerJoin(dataset, eq(dataset.id, clientDataset.datasetId))
      .where(and(eq(clientDataset.clientId, c.req.param("clientId")), isNull(dataset.deletedAt)));
    return c.json({ datasetIds: rows.map((row) => row.datasetId) });
  })
  .put(
    "/api/admin/clients/:clientId/datasets",
    validate(z.object({ datasetIds: z.array(z.uuid()).max(500) }).strict()),
    async (c) => {
      const ids = [...new Set(c.req.valid("json").datasetIds)];
      const available = await datasetDb()
        .select({ id: dataset.id })
        .from(dataset)
        .where(and(isNull(dataset.deletedAt), inArray(dataset.id, jsonIds(ids))));
      if (available.length !== ids.length) return c.json({ error: "Dataset not found" }, 400);
      const clientId = c.req.param("clientId");
      const db = datasetDb();
      await db.batch([
        db.delete(clientDataset).where(eq(clientDataset.clientId, clientId)),
        db.insert(clientDataset).select(
          db
            .select({ clientId: sql<string>`${clientId}`.as("clientId"), datasetId: dataset.id })
            .from(dataset)
            .where(and(isNull(dataset.deletedAt), inArray(dataset.id, jsonIds(ids)))),
        ),
      ]);
      return c.json({ ok: true });
    },
  )
  .use("/api/admin/datasets/*", requireAdmin)
  .use("/api/admin/datasets/*", bodyLimit({ maxSize: 64 * 1024 }))
  .use("/api/admin/datasets/:datasetId/*", async (c, next) => {
    if (!z.uuid().safeParse(c.req.param("datasetId")).success)
      return c.json({ error: "Invalid dataset ID" }, 400);
    if (
      !(await getDataset(c.req.param("datasetId"))) &&
      !(
        c.req.method === "POST" &&
        c.req.path.endsWith("/sync") &&
        (await datasetDb()
          .select({ id: dataset.id })
          .from(dataset)
          .where(eq(dataset.id, c.req.param("datasetId")))
          .get())
      )
    )
      return c.json({ error: "Dataset not found" }, 404);
    await next();
  })
  .get("/api/admin/datasets", async (c) => {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(0).max(100000).default(0),
        pageSize: z.coerce
          .number()
          .refine((value) => value === 10 || value === 9)
          .default(9),
        q: z.string().trim().max(100).default(""),
      })
      .safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: "Invalid search or page" }, 400);
    const { page, pageSize, q } = parsed.data;
    const rows = await datasetDb()
      .select(datasetColumns)
      .from(dataset)
      .where(
        and(
          isNull(dataset.deletedAt),
          q
            ? or(
                sql`instr(lower(${dataset.name}), lower(${q})) > 0`,
                sql`instr(lower(${dataset.description}), lower(${q})) > 0`,
              )
            : undefined,
        ),
      )
      .orderBy(desc(dataset.createdAt), desc(dataset.id))
      .limit(pageSize + 1)
      .offset(page * pageSize);
    return c.json({
      datasets: rows.slice(0, pageSize),
      hasMore: rows.length > pageSize,
    });
  })
  .post("/api/admin/datasets", validate(datasetInput), async (c) => {
    const { name, description } = c.req.valid("json");
    const id = crypto.randomUUID();
    // A server-generated, dedicated instance prevents caller-selected index access.
    const instanceName = id.replaceAll("-", "");
    await datasetDb()
      .insert(dataset)
      .values({ id, name, description, instanceName, createdAt: Date.now() });
    return c.json(await getDataset(id), 201);
  })
  .get("/api/admin/datasets/:datasetId", async (c) => {
    const id = c.req.param("datasetId");
    const [foundDataset, categories, clients] = await Promise.all([
      getDataset(id),
      getCategories(id),
      datasetDb()
        .select({ clientId: clientDataset.clientId })
        .from(clientDataset)
        .where(eq(clientDataset.datasetId, id)),
    ]);
    return c.json({
      dataset: foundDataset,
      categories,
      clientIds: clients.map((row) => row.clientId),
    });
  })
  .put("/api/admin/datasets/:datasetId", validate(datasetInput), async (c) => {
    const { name, description } = c.req.valid("json");
    await datasetDb()
      .update(dataset)
      .set({ name, description })
      .where(and(eq(dataset.id, c.req.param("datasetId")), isNull(dataset.deletedAt)));
    return c.json(await getDataset(c.req.param("datasetId")));
  })
  .delete("/api/admin/datasets/:datasetId", async (c) => {
    const id = c.req.param("datasetId");
    const db = datasetDb();
    await db.batch([
      db.update(dataset).set({ deletedAt: Date.now() }).where(eq(dataset.id, id)),
      db.delete(clientDataset).where(eq(clientDataset.datasetId, id)),
    ]);
    await kickSync(c.req.param("datasetId"));
    return c.json({ ok: true, deletionPending: true }, 202);
  })
  .put(
    "/api/admin/datasets/:datasetId/clients",
    validate(z.object({ clientIds: z.array(z.uuid()).max(500) }).strict()),
    async (c) => {
      const ids = [...new Set(c.req.valid("json").clientIds)];
      const datasetId = c.req.param("datasetId");
      const clients = await datasetDb()
        .select({ id: client.id })
        .from(client)
        .where(inArray(client.id, jsonIds(ids)));
      if (clients.length !== ids.length) return c.json({ error: "Client not found" }, 400);
      const db = datasetDb();
      await db.batch([
        db.delete(clientDataset).where(eq(clientDataset.datasetId, datasetId)),
        db.insert(clientDataset).select(
          db
            .select({ clientId: client.id, datasetId: dataset.id })
            .from(client)
            .innerJoin(dataset, eq(dataset.id, datasetId))
            .where(and(inArray(client.id, jsonIds(ids)), isNull(dataset.deletedAt))),
        ),
      ]);
      return c.json({ ok: true });
    },
  )
  .use("/api/admin/datasets/:datasetId/categories/:categoryId/*", async (c, next) => {
    if (!z.uuid().safeParse(c.req.param("categoryId")).success)
      return c.json({ error: "Invalid model ID" }, 400);
    await next();
  })
  .post("/api/admin/datasets/:datasetId/categories", validate(categoryInput), async (c) => {
    const { name, schema } = c.req.valid("json");
    const id = crypto.randomUUID();
    const datasetId = c.req.param("datasetId");
    await datasetDb().batch([insertModel(datasetId, id, name), insertModelSchema(id, schema)]);
    return c.json({ id }, 201);
  })
  .get("/api/admin/datasets/:datasetId/categories/:categoryId/versions", async (c) => {
    const rows = await datasetDb()
      .select({ version: datasetSchema.version, schemaJson: datasetSchema.schemaJson })
      .from(datasetSchema)
      .innerJoin(datasetCategory, eq(datasetCategory.id, datasetSchema.categoryId))
      .where(
        and(
          eq(datasetCategory.id, c.req.param("categoryId")),
          eq(datasetCategory.datasetId, c.req.param("datasetId")),
        ),
      )
      .orderBy(desc(datasetSchema.version));
    return c.json(
      rows.map((row) => ({
        version: row.version,
        schema: JSON.parse(row.schemaJson) as DataSchema,
      })),
    );
  })
  .put(
    "/api/admin/datasets/:datasetId/categories/:categoryId",
    validate(categoryUpdate),
    async (c) => {
      const { name, schema, expectedVersion } = c.req.valid("json");
      const id = c.req.param("categoryId");
      const datasetId = c.req.param("datasetId");
      // Insert and advance atomically. Concurrent publishers cannot overwrite a version.
      const db = datasetDb();
      const result = await db.batch([
        db
          .insert(datasetSchema)
          .select(
            db
              .select({
                id: sql<string>`${id + ":" + (expectedVersion + 1)}`.as("id"),
                categoryId: datasetCategory.id,
                version: sql<number>`${datasetCategory.version} + 1`.as("version"),
                schemaJson: sql<string>`${JSON.stringify(schema)}`.as("schemaJson"),
                createdAt: sql<number>`${Date.now()}`.as("createdAt"),
              })
              .from(datasetCategory)
              .where(currentModel(id, datasetId, expectedVersion)),
          )
          .onConflictDoNothing(),
        db
          .update(datasetCategory)
          .set({ name, version: sql`${datasetCategory.version} + 1` })
          .where(currentModel(id, datasetId, expectedVersion)),
      ]);
      return result[1]!.meta.changes
        ? c.json({ ok: true })
        : c.json({ error: "Schema changed or was archived; reload before publishing" }, 409);
    },
  )
  .delete("/api/admin/datasets/:datasetId/categories/:categoryId", async (c) => {
    const result = await datasetDb()
      .update(datasetCategory)
      .set({ archivedAt: Date.now() })
      .where(
        and(
          eq(datasetCategory.id, c.req.param("categoryId")),
          eq(datasetCategory.datasetId, c.req.param("datasetId")),
          isNull(datasetCategory.archivedAt),
        ),
      )
      .run();
    return result.meta.changes
      ? c.json({ ok: true })
      : c.json({ error: "Category not found" }, 404);
  })
  .get("/api/admin/datasets/:datasetId/records", async (c) => {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(0).max(100000).default(0),
        q: z.string().trim().max(100).default(""),
      })
      .safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: "Invalid search or page" }, 400);
    const { page, q } = parsed.data;
    if (import.meta.env.DEV) {
      try {
        await recoverDevelopmentSync(c.req.param("datasetId"));
      } catch {
        console.error("Development dataset recovery could not enqueue pending jobs");
      }
    }
    const rows = await datasetDb()
      .select({ ...recordColumns, schemaJson: datasetSchema.schemaJson })
      .from(datasetRecord)
      .innerJoin(datasetSchema, eq(datasetSchema.id, datasetRecord.schemaId))
      .leftJoin(
        datasetSearchJob,
        and(
          eq(datasetSearchJob.recordId, datasetRecord.id),
          eq(datasetSearchJob.revision, datasetRecord.revision),
        ),
      )
      .where(
        and(
          eq(datasetRecord.datasetId, c.req.param("datasetId")),
          isNull(datasetRecord.deletedAt),
          q
            ? or(
                sql`instr(lower(${datasetRecord.title}), lower(${q})) > 0`,
                sql`json_type(${datasetRecord.dataJson}, '$.name') = 'text' and instr(lower(json_extract(${datasetRecord.dataJson}, '$.name')), lower(${q})) > 0`,
              )
            : undefined,
        ),
      )
      .orderBy(desc(datasetRecord.updatedAt), datasetRecord.id)
      .limit(11)
      .offset(page * 10);
    return c.json({
      records: rows.slice(0, 10).map(({ dataJson, schemaJson, ...row }) => ({
        ...row,
        categoryId: row.categoryId?.endsWith(":markdown") ? null : row.categoryId,
        data: JSON.parse(dataJson) as Record<string, unknown>,
        schema: JSON.parse(schemaJson) as DataSchema,
      })),
      hasMore: rows.length > 10,
    });
  })
  .get("/api/admin/datasets/:datasetId/records/:recordId", async (c) => {
    const row = await datasetDb()
      .select({ ...recordColumns, schemaJson: datasetSchema.schemaJson })
      .from(datasetRecord)
      .innerJoin(datasetSchema, eq(datasetSchema.id, datasetRecord.schemaId))
      .leftJoin(
        datasetSearchJob,
        and(
          eq(datasetSearchJob.recordId, datasetRecord.id),
          eq(datasetSearchJob.revision, datasetRecord.revision),
        ),
      )
      .where(
        and(
          eq(datasetRecord.id, c.req.param("recordId")),
          eq(datasetRecord.datasetId, c.req.param("datasetId")),
          isNull(datasetRecord.deletedAt),
        ),
      )
      .get();
    if (!row) return c.json({ error: "Record not found" }, 404);
    const { dataJson, schemaJson, ...record } = row;
    return c.json({
      ...record,
      categoryId: record.categoryId.endsWith(":markdown") ? null : record.categoryId,
      data: JSON.parse(dataJson) as Record<string, unknown>,
      schema: JSON.parse(schemaJson) as DataSchema,
    });
  })
  .post("/api/admin/datasets/:datasetId/records", validate(recordInput), async (c) => {
    const input = c.req.valid("json");
    const datasetId = c.req.param("datasetId");
    const category = await getRecordModel(datasetId, input.categoryId);
    if (!category || category.version !== input.schemaVersion)
      return c.json({ error: "Schema changed or is unavailable; reload before saving" }, 409);
    const errors = validateData(category.schema, input.data);
    if (JSON.stringify(input.data).length > 16000 || errors.length)
      return c.json(
        { error: "Record does not match schema or exceeds 16000 characters", details: errors },
        400,
      );
    const id = crypto.randomUUID();
    const db = datasetDb();
    const result = await db.batch([
      db.insert(datasetRecord).select(
        db
          .select({
            enabled: sql<boolean>`1`.as("enabled"),
            id: sql<string>`${id}`.as("id"),
            datasetId: datasetCategory.datasetId,
            categoryId: datasetCategory.id,
            schemaId: sql<string>`${category.id + ":" + category.version}`.as("schemaId"),
            schemaVersion: datasetCategory.version,
            title: sql<string>`${input.title}`.as("title"),
            dataJson: sql<string>`${JSON.stringify(input.data)}`.as("dataJson"),
            revision: sql<number>`1`.as("revision"),
            updatedAt: sql<number>`${Date.now()}`.as("updatedAt"),
            deletedAt: sql<null>`null`.as("deletedAt"),
          })
          .from(datasetCategory)
          .innerJoin(dataset, eq(dataset.id, datasetCategory.datasetId))
          .where(
            and(currentModel(category.id, datasetId, category.version), isNull(dataset.deletedAt)),
          ),
      ),
      enqueueRecord(id),
    ]);
    if (!result[0]!.meta.changes)
      return c.json({ error: "Schema changed; reload before saving" }, 409);
    await kickSync(c.req.param("datasetId"));
    return c.json({ id }, 201);
  })
  .put("/api/admin/datasets/:datasetId/records/:recordId", validate(recordUpdate), async (c) => {
    const input = c.req.valid("json");
    const datasetId = c.req.param("datasetId");
    const id = c.req.param("recordId");
    const category = await getRecordModel(datasetId, input.categoryId);
    if (!category || category.version !== input.schemaVersion)
      return c.json({ error: "Schema changed or is unavailable; reload before saving" }, 409);
    const errors = validateData(category.schema, input.data);
    if (JSON.stringify(input.data).length > 16000 || errors.length)
      return c.json(
        { error: "Record does not match schema or exceeds 16000 characters", details: errors },
        400,
      );
    // Every save explicitly validates against the current schema, including upgrades from old versions.
    const db = datasetDb();
    const result = await db.batch([
      db
        .update(datasetRecord)
        .set({
          categoryId: category.id,
          schemaId: category.id + ":" + category.version,
          schemaVersion: category.version,
          title: input.title,
          dataJson: JSON.stringify(input.data),
          revision: sql`${datasetRecord.revision} + 1`,
          updatedAt: Date.now(),
        })
        .where(
          and(
            eq(datasetRecord.id, id),
            eq(datasetRecord.datasetId, datasetId),
            eq(datasetRecord.revision, input.expectedRevision),
            isNull(datasetRecord.deletedAt),
            exists(
              db
                .select({ id: datasetCategory.id })
                .from(datasetCategory)
                .innerJoin(dataset, eq(dataset.id, datasetCategory.datasetId))
                .where(
                  and(
                    currentModel(category.id, datasetId, category.version),
                    isNull(dataset.deletedAt),
                  ),
                ),
            ),
          ),
        ),
      db
        .update(datasetSearchJob)
        .set({ status: "pending", nextAttemptAt: 0 })
        .where(
          and(
            eq(datasetSearchJob.recordId, id),
            eq(datasetSearchJob.datasetId, datasetId),
            ne(datasetSearchJob.status, "deleted"),
            lt(
              datasetSearchJob.revision,
              db
                .select({ revision: datasetRecord.revision })
                .from(datasetRecord)
                .where(and(eq(datasetRecord.id, id), eq(datasetRecord.datasetId, datasetId))),
            ),
          ),
        ),
      enqueueRecord(id, datasetId),
    ]);
    if (!result[0]!.meta.changes)
      return c.json({ error: "Record or schema changed; reload before saving" }, 409);
    await kickSync(c.req.param("datasetId"));
    return c.json({ ok: true });
  })
  .put(
    "/api/admin/datasets/:datasetId/records/:recordId/enabled",
    validate(
      z
        .object({
          enabled: z.boolean(),
          expectedRevision: z.number().int().positive(),
        })
        .strict(),
    ),
    async (c) => {
      const { enabled, expectedRevision } = c.req.valid("json");
      const datasetId = c.req.param("datasetId");
      const id = c.req.param("recordId");
      const db = datasetDb();
      const result = await db.batch([
        db
          .update(datasetRecord)
          .set({
            enabled,
            revision: sql`${datasetRecord.revision} + 1`,
            updatedAt: Date.now(),
          })
          .where(
            and(
              eq(datasetRecord.id, id),
              eq(datasetRecord.datasetId, datasetId),
              eq(datasetRecord.revision, expectedRevision),
              isNull(datasetRecord.deletedAt),
            ),
          ),
        db
          .update(datasetSearchJob)
          .set({ status: "pending", nextAttemptAt: 0 })
          .where(
            and(
              eq(datasetSearchJob.recordId, id),
              eq(datasetSearchJob.datasetId, datasetId),
              ne(datasetSearchJob.status, "deleted"),
              lt(
                datasetSearchJob.revision,
                db
                  .select({ revision: datasetRecord.revision })
                  .from(datasetRecord)
                  .where(and(eq(datasetRecord.id, id), eq(datasetRecord.datasetId, datasetId))),
              ),
            ),
          ),
        enqueueRecord(id, datasetId),
      ]);
      if (!result[0]!.meta.changes)
        return c.json({ error: "Record changed; reload before saving" }, 409);
      await kickSync(datasetId);
      return c.json({ ok: true });
    },
  )
  .delete("/api/admin/datasets/:datasetId/records/:recordId", async (c) => {
    const id = c.req.param("recordId");
    const found = await datasetDb()
      .select({ id: datasetRecord.id })
      .from(datasetRecord)
      .where(
        and(
          eq(datasetRecord.id, id),
          eq(datasetRecord.datasetId, c.req.param("datasetId")),
          isNull(datasetRecord.deletedAt),
        ),
      )
      .get();
    if (!found) return c.json({ error: "Record not found" }, 404);
    await datasetDb().batch([
      datasetDb()
        .update(datasetRecord)
        .set({ deletedAt: Date.now() })
        .where(eq(datasetRecord.id, id)),
      wakeOldJobs(id),
    ]);
    await kickSync(c.req.param("datasetId"));
    return c.json({ ok: true });
  })
  .post("/api/admin/datasets/:datasetId/sync", async (c) => {
    await datasetDb()
      .update(datasetSearchJob)
      .set({ nextAttemptAt: 0, attempts: 0 })
      .where(
        and(
          eq(datasetSearchJob.datasetId, c.req.param("datasetId")),
          notInArray(datasetSearchJob.status, ["ready", "deleted"]),
        ),
      );
    await kickSync(c.req.param("datasetId"));
    return c.json({ ok: true }, 202);
  });
