import { and, eq, isNull, ne, notLike, sql } from "drizzle-orm";
import { markdownRecordSchema, type Category, type DataSchema } from "@shared/datasets";
import { createDb } from "../db/client";
import {
  dataset,
  datasetCategory,
  datasetSchema,
  datasetRecord,
  datasetSearchJob,
} from "../db/schema";

export const datasetDb = createDb;
export const datasetColumns = {
  id: dataset.id,
  name: dataset.name,
  description: dataset.description,
  instanceName: dataset.instanceName,
  createdAt: dataset.createdAt,
};
export const getDataset = (id: string) =>
  datasetDb()
    .select(datasetColumns)
    .from(dataset)
    .where(and(eq(dataset.id, id), isNull(dataset.deletedAt)))
    .get();

export async function getCategories(datasetId: string): Promise<Category[]> {
  const rows = await datasetDb()
    .select({
      id: datasetCategory.id,
      datasetId: datasetCategory.datasetId,
      name: datasetCategory.name,
      version: datasetCategory.version,
      archivedAt: datasetCategory.archivedAt,
      schemaJson: datasetSchema.schemaJson,
    })
    .from(datasetCategory)
    .innerJoin(
      datasetSchema,
      and(
        eq(datasetSchema.categoryId, datasetCategory.id),
        eq(datasetSchema.version, datasetCategory.version),
      ),
    )
    .where(and(eq(datasetCategory.datasetId, datasetId), notLike(datasetCategory.id, "%:markdown")))
    .orderBy(datasetCategory.name, datasetCategory.id);
  return rows.map(({ schemaJson, ...row }) => ({
    ...row,
    schema: JSON.parse(schemaJson) as DataSchema,
  }));
}
export const wakeOldJobs = (recordId: string) =>
  datasetDb()
    .update(datasetSearchJob)
    .set({ status: "pending", nextAttemptAt: 0 })
    .where(and(eq(datasetSearchJob.recordId, recordId), ne(datasetSearchJob.status, "deleted")));

export const enqueueRecord = (recordId: string, datasetId?: string) => {
  const db = datasetDb();
  return db
    .insert(datasetSearchJob)
    .select(
      db
        .select({
          id: sql<string>`${datasetRecord.id} || ':' || ${datasetRecord.revision}`.as("id"),
          datasetId: datasetRecord.datasetId,
          recordId: datasetRecord.id,
          revision: datasetRecord.revision,
          itemKey: sql<string>`${datasetRecord.id} || '/' || ${datasetRecord.revision} || '.md'`.as(
            "itemKey",
          ),
          itemId: sql<null>`null`.as("itemId"),
          status: sql<string>`'pending'`.as("status"),
          attempts: sql<number>`0`.as("attempts"),
          nextAttemptAt: sql<number>`0`.as("nextAttemptAt"),
          leaseToken: sql<null>`null`.as("leaseToken"),
          leaseUntil: sql<number>`0`.as("leaseUntil"),
          error: sql<null>`null`.as("error"),
        })
        .from(datasetRecord)
        .where(
          and(
            eq(datasetRecord.id, recordId),
            isNull(datasetRecord.deletedAt),
            datasetId ? eq(datasetRecord.datasetId, datasetId) : undefined,
          ),
        ),
    )
    .onConflictDoNothing();
};

export const insertModel = (datasetId: string, id: string, name: string) => {
  const db = datasetDb();
  return db.insert(datasetCategory).select(
    db
      .select({
        id: sql<string>`${id}`.as("id"),
        datasetId: dataset.id,
        name: sql<string>`${name}`.as("name"),
        version: sql<number>`1`.as("version"),
        archivedAt: sql<null>`null`.as("archivedAt"),
      })
      .from(dataset)
      .where(and(eq(dataset.id, datasetId), isNull(dataset.deletedAt))),
  );
};
export const insertModelSchema = (id: string, schema: DataSchema) => {
  const db = datasetDb();
  return db.insert(datasetSchema).select(
    db
      .select({
        id: sql<string>`${id + ":1"}`.as("id"),
        categoryId: datasetCategory.id,
        version: sql<number>`1`.as("version"),
        schemaJson: sql<string>`${JSON.stringify(schema)}`.as("schemaJson"),
        createdAt: sql<number>`${Date.now()}`.as("createdAt"),
      })
      .from(datasetCategory)
      .where(eq(datasetCategory.id, id)),
  );
};

export async function getRecordModel(datasetId: string, categoryId: string | null) {
  if (categoryId) {
    const row = await datasetDb()
      .select({
        id: datasetCategory.id,
        version: datasetCategory.version,
        schemaJson: datasetSchema.schemaJson,
      })
      .from(datasetCategory)
      .innerJoin(
        datasetSchema,
        and(
          eq(datasetSchema.categoryId, datasetCategory.id),
          eq(datasetSchema.version, datasetCategory.version),
        ),
      )
      .where(
        and(
          eq(datasetCategory.id, categoryId),
          eq(datasetCategory.datasetId, datasetId),
          isNull(datasetCategory.archivedAt),
        ),
      )
      .get();
    return row
      ? { id: row.id, version: row.version, schema: JSON.parse(row.schemaJson) as DataSchema }
      : undefined;
  }
  // Internal immutable model preserves existing foreign keys without exposing a user model.
  const id = `${datasetId}:markdown`;
  await datasetDb().batch([
    insertModel(datasetId, id, "Markdown").onConflictDoNothing(),
    insertModelSchema(id, markdownRecordSchema).onConflictDoNothing(),
  ]);
  return { id, version: 1, schema: markdownRecordSchema };
}
