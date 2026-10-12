import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  role: text("role").default("user"),
  banned: integer("banned", { mode: "boolean" }).default(false),
  banReason: text("banReason"),
  banExpires: integer("banExpires", { mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  impersonatedBy: text("impersonatedBy"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  idToken: text("idToken"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

export const client = sqliteTable("client", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  platform: text("platform", {
    enum: ["telegram", "web", "react-native", "flutter"],
  }).notNull(),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const telegramWhitelistUser = sqliteTable("telegram_whitelist_user", {
  type: text("type", { enum: ["private", "group"] }).notNull(),
  id: text("id").notNull(),
  remark: text("remark"),
  createdAt: integer("createdAt").notNull(),
}, (table) => [
  primaryKey({
    columns: [table.type, table.id],
  }),
]);

export const clientSkill = sqliteTable("client_skill", {
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  builtInKey: text("built_in_key"),
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => client.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("client_skill_client_id_idx").on(table.clientId),
  uniqueIndex("client_skill_builtin_idx").on(table.clientId, table.builtInKey),
]);

export const dataset = sqliteTable("dataset", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  instanceName: text("instance_name").notNull(),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  uniqueIndex("dataset_instance_unique").on(table.instanceName)
]);

export const clientDataset = sqliteTable("client_dataset", {
  clientId: text("client_id").notNull().references(() => client.id, { onDelete: "cascade" }),
  datasetId: text("dataset_id").notNull().references(() => dataset.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.clientId, table.datasetId] }),
  index("client_dataset_dataset_idx").on(table.datasetId)
]);

export const datasetCategory = sqliteTable("dataset_category", {
  id: text("id").primaryKey(),
  datasetId: text("dataset_id").notNull().references(() => dataset.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  version: integer("version").notNull(),
  archivedAt: integer("archived_at"),
}, (table) => [
  index("dataset_category_dataset_idx").on(table.datasetId)
]);

export const datasetSchema = sqliteTable("dataset_schema", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull().references(() => datasetCategory.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  schemaJson: text("schema_json").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("dataset_schema_version_unique").on(table.categoryId, table.version)
]);

export const datasetRecord = sqliteTable("dataset_record", {
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  id: text("id").primaryKey(),
  datasetId: text("dataset_id").notNull().references(() => dataset.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => datasetCategory.id, { onDelete: "cascade" }),
  schemaId: text("schema_id").notNull().references(() => datasetSchema.id, { onDelete: "cascade" }),
  schemaVersion: integer("schema_version").notNull(),
  title: text("title").notNull(),
  dataJson: text("data_json").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  index("dataset_record_page_idx").on(table.datasetId, table.deletedAt, table.updatedAt, table.id)
]);

export const datasetSearchJob = sqliteTable("dataset_search_job", {
  id: text("id").primaryKey(),
  datasetId: text("dataset_id").notNull().references(() => dataset.id, { onDelete: "cascade" }),
  recordId: text("record_id").notNull().references(() => datasetRecord.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  itemKey: text("item_key").notNull(),
  itemId: text("item_id"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: integer("next_attempt_at").notNull().default(0),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until").notNull().default(0),
  error: text("error"),
}, (table) => [
  uniqueIndex("dataset_search_job_key_unique").on(table.datasetId, table.itemKey),
  index("dataset_search_job_due_idx").on(table.status, table.nextAttemptAt),
  index("dataset_search_job_record_idx").on(table.recordId)
]);
