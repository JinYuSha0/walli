import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { Hono } from "hono";
import { datasetsRoute } from "./datasets";
import type { AppBindings } from "./types";
import { runWithChatAsyncContext } from "../lib/async-context";
import { searchDatasets } from "../datasets/search";
import {
  consumeDatasetSync,
  recoverDevelopmentSync,
  type DatasetSyncMessage,
} from "../datasets/sync";
import { toolsRoute } from "../tools";
import { dataSchema, validateData } from "@shared/datasets";

let queued: { body: DatasetSyncMessage; delayed: boolean }[];
let send: ReturnType<typeof vi.fn>;
let sqlite: DatabaseSync;
let env: Env;
let search: ReturnType<typeof vi.fn>;
let upload: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
let itemInfo: ReturnType<typeof vi.fn>;
let info: ReturnType<typeof vi.fn>;
let remoteItems: Map<string, { id: string; key: string; status: string }>;
const clientA = "11111111-1111-4111-8111-111111111111";
const clientB = "22222222-2222-4222-8222-222222222222";
const schema = {
  type: "object",
  properties: { content: { type: "string" } },
  required: ["content"],
  additionalProperties: false,
};
const context = <T>(fn: () => T, clientId?: string) =>
  runWithChatAsyncContext(
    {
      env,
      origin: "https://test.example",
      ...(clientId ? { userInfo: { userId: "user", clientId } } : {}),
    },
    fn,
  );
const app = new Hono<AppBindings>()
  .use("*", async (c, next) => {
    const role = c.req.header("x-test-role");
    if (role) c.set("user", { id: "admin", role } as AppBindings["Variables"]["user"]);
    await next();
  })
  .route("/", datasetsRoute);
const request = (path = "", method = "GET", body?: unknown, role: string | null = "admin") =>
  context(() =>
    app.request(`https://test.example/api/admin/datasets${path}`, {
      method,
      headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
const createDataset = async (name = "Reference") =>
  (await (await request("", "POST", { name })).json()) as { id: string; instanceName: string };
const createCategory = async (datasetId: string) =>
  (await (await request(`/${datasetId}/categories`, "POST", { name: "Notes", schema })).json()) as {
    id: string;
  };
const createRecord = async (
  datasetId: string,
  categoryId: string,
  content = "Reference material",
) =>
  (await (
    await request(`/${datasetId}/records`, "POST", {
      categoryId,
      schemaVersion: 1,
      title: "Note",
      data: { content },
    })
  ).json()) as { id: string };
const records = async (id: string) => (await (await request(`/${id}/records`)).json()).records;
const deliver = (body: DatasetSyncMessage) => {
  const ack = vi.fn();
  const retry = vi.fn(() => queued.push({ body, delayed: true }));
  return context(async () => {
    await consumeDatasetSync({
      messages: [{ id: crypto.randomUUID(), body, ack, retry }],
    } as unknown as MessageBatch<DatasetSyncMessage>);
    return { ack, retry };
  });
};
const runSync = async () => {
  let pending = queued.splice(0);
  while (pending.length) {
    for (const message of pending) await deliver(message.body);
    pending = queued.filter((message) => !message.delayed);
    queued = queued.filter((message) => message.delayed);
  }
};
const searchAs = (clientId: string, datasetId?: string) =>
  context(() => searchDatasets({ query: "reference", datasetId, limit: 5 }), clientId);

beforeEach(() => {
  queued = [];
  send = vi.fn(async (body: DatasetSyncMessage, options?: { delaySeconds?: number }) => {
    queued.push({ body, delayed: !!options?.delaySeconds });
  });
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync("migrations/0000_initial.sql", "utf8"));
  sqlite.prepare("INSERT INTO client VALUES (?, 'A', 'a', 'web', 1, 1)").run(clientA);
  sqlite.prepare("INSERT INTO client VALUES (?, 'B', 'b', 'telegram', 1, 1)").run(clientB);
  const prepare = (sql: string, values: SQLInputValue[] = []) => ({
    bind: (...args: SQLInputValue[]) => prepare(sql, args),
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
    raw: async () => {
      const statement = sqlite.prepare(sql);
      statement.setReturnArrays(true);
      return statement.all(...values);
    },
    all: async () => ({ results: sqlite.prepare(sql).all(...values), success: true }),
    run: async () => ({
      success: true,
      meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) },
    }),
  });
  remoteItems = new Map();
  info = vi.fn(async () => ({ id: "instance" }));
  search = vi.fn(async () => ({ chunks: [] }));
  upload = vi.fn(async (key: string) => {
    const item = { id: key, key, status: "completed" };
    remoteItems.set(key, item);
    return item;
  });
  remove = vi.fn(async (id: string) => {
    remoteItems.delete(id);
  });
  itemInfo = vi.fn(async (id: string) => remoteItems.get(id));
  env = {
    API_TOKEN: "test-token",
    DATASET_SYNC_QUEUE: {
      send,
      sendBatch: async (messages: { body: DatasetSyncMessage }[]) => {
        for (const { body } of messages) await send(body);
      },
    },
    DB: {
      prepare,
      batch: async (statements: ReturnType<typeof prepare>[]) => {
        sqlite.exec("BEGIN");
        try {
          const results = [];
          for (const statement of statements) results.push(await statement.run());
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    },
    DATASET_SEARCH: {
      delete: vi.fn(async () => {
        remoteItems.clear();
      }),
      get: vi.fn(() => ({
        info,
        update: vi.fn(),
        search,
        items: {
          upload,
          delete: remove,
          list: async () => ({ result: [...remoteItems.values()] }),
          get: (id: string) => ({ info: () => itemInfo(id), sync: vi.fn() }),
        },
      })),
    },
  } as unknown as Env;
});
afterEach(() => sqlite.close());

it("protects every admin route including list/create/detail and rejects unsupported schemas", async () => {
  expect((await request("", "GET", undefined, null)).status).toBe(401);
  expect((await request("", "POST", { name: "A" }, "user")).status).toBe(403);
  const ds = await createDataset();
  expect((await request(`/${ds.id}`, "GET", undefined, null)).status).toBe(401);
  expect(
    (
      await request(`/${ds.id}/categories`, "POST", {
        name: "Bad",
        schema: { ...schema, $ref: "https://example.com" },
      })
    ).status,
  ).toBe(400);
  expect(
    (await request(`/${ds.id}/clients`, "PUT", { clientIds: [crypto.randomUUID()] })).status,
  ).toBe(400);
  expect((await request(`/${ds.id}/records`, "GET", undefined, "user")).status).toBe(403);
});

it("supports many-to-many grants and does not contact search for an unbound client", async () => {
  const a = await createDataset("A");
  const b = await createDataset("B");
  await request(`/${a.id}/clients`, "PUT", { clientIds: [clientA, clientB] });
  await request(`/${b.id}/clients`, "PUT", { clientIds: [clientA] });
  const catalog = await context(() => searchDatasets({ query: "", limit: 5 }), clientA);
  expect(catalog).toMatchObject({ datasets: [{ id: a.id }, { id: b.id }] });
  expect(await searchAs(clientB, b.id)).toMatchObject({ error: expect.any(String) });
  expect(search).not.toHaveBeenCalled();
  await request(`/${a.id}/clients`, "PUT", { clientIds: [] });
  expect(await searchAs(clientB)).toEqual({ results: [] });
  expect(search).not.toHaveBeenCalled();
});

it("versions schemas without modifying old records, validates upgrades and rejects stale writers", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  const nextSchema = {
    ...schema,
    properties: { content: { type: "string" }, price: { type: "number", minimum: 0 } },
    required: ["content", "price"],
  };
  expect(
    (
      await request(`/${ds.id}/categories/${category.id}`, "PUT", {
        name: "Products",
        schema: nextSchema,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/${ds.id}/categories/${category.id}`, "PUT", {
        name: "Overwrite",
        schema,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(409);
  expect(await records(ds.id)).toMatchObject([
    { schemaVersion: 1, data: { content: "Reference material" } },
  ]);
  const body = {
    categoryId: category.id,
    schemaVersion: 2,
    title: "Updated",
    data: { content: "Updated" },
    expectedRevision: 1,
  };
  expect((await request(`/${ds.id}/records/${record.id}`, "PUT", body)).status).toBe(400);
  expect(
    (
      await request(`/${ds.id}/records/${record.id}`, "PUT", {
        ...body,
        data: { content: "Updated", price: 10 },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(`/${ds.id}/records/${record.id}`, "PUT", {
        ...body,
        data: { content: "Updated", price: 20 },
      })
    ).status,
  ).toBe(409);
  expect(await records(ds.id)).toMatchObject([
    { schemaVersion: 2, revision: 2, data: { price: 10 } },
  ]);
  await request(`/${ds.id}/categories/${category.id}`, "DELETE");
  expect(
    (
      await request(`/${ds.id}/records`, "POST", {
        categoryId: category.id,
        schemaVersion: 2,
        title: "No",
        data: { content: "X", price: 10 },
      })
    ).status,
  ).toBe(409);
  expect(
    (await (await request(`/${ds.id}/categories/${category.id}/versions`)).json()).length,
  ).toBe(2);
});

it("rejects cross-dataset record/schema mutations and invalid typed data", async () => {
  const a = await createDataset();
  const b = await createDataset();
  const category = await createCategory(a.id);
  const record = await createRecord(a.id, category.id);
  expect(
    (
      await request(`/${b.id}/records`, "POST", {
        categoryId: category.id,
        schemaVersion: 1,
        title: "No",
        data: { content: "X" },
      })
    ).status,
  ).toBe(409);
  expect((await request(`/${b.id}/records/${record.id}`, "DELETE")).status).toBe(404);
  expect((await request(`/${b.id}/categories/${category.id}`, "DELETE")).status).toBe(404);
  expect(
    (
      await request(`/${a.id}/records`, "POST", {
        categoryId: category.id,
        schemaVersion: 1,
        title: "No",
        data: { content: 123 },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(`/${a.id}/records`, "POST", {
        categoryId: category.id,
        schemaVersion: 1,
        title: "No",
        data: { content: "X", extra: true },
      })
    ).status,
  ).toBe(400);
});

it("atomically saves outbox work, retries failures and recovers an upload with a lost response", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  upload.mockImplementationOnce(async (key: string) => {
    remoteItems.set(key, { id: key, key, status: "completed" });
    throw new Error("Lost response with secret content");
  });
  await runSync();
  expect(await records(ds.id)).toMatchObject([
    { syncStatus: "error", syncError: "AI Search synchronization failed; retry scheduled" },
  ]);
  await request(`/${ds.id}/sync`, "POST");
  await runSync();
  expect(upload).toHaveBeenCalledTimes(1);
  expect(await records(ds.id)).toMatchObject([{ id: record.id, syncStatus: "ready" }]);
  expect(sqlite.prepare("SELECT count(*) AS n FROM dataset_search_job").get()?.n).toBe(1);
});

it("retries empty hybrid retrieval with vectors and still filters unauthorized hits", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  await request(`/${ds.id}/clients`, "PUT", { clientIds: [clientA] });
  await runSync();
  search.mockResolvedValueOnce({ chunks: [] }).mockResolvedValueOnce({
    chunks: [
      { score: 0.43, item: { key: `${record.id}/1.md` } },
      { score: 1, item: { key: "unowned/1.md" } },
    ],
  });
  expect(await searchAs(clientA)).toMatchObject({ results: [{ id: record.id }] });
  expect(search).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      ai_search_options: expect.objectContaining({
        retrieval: expect.objectContaining({ retrieval_type: "vector", metadata_only: true }),
      }),
    }),
  );
});

it("disables retrieval immediately, removes indexed data, and reindexes on enable", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  await request(`/${ds.id}/clients`, "PUT", { clientIds: [clientA] });
  await runSync();
  search.mockResolvedValue({ chunks: [{ score: 1, item: { key: `${record.id}/1.md` } }] });
  expect((await searchAs(clientA)).results).toHaveLength(1);
  const other = await createDataset();
  expect(
    (
      await request(`/${other.id}/records/${record.id}/enabled`, "PUT", {
        enabled: false,
        expectedRevision: 1,
      })
    ).status,
  ).toBe(409);
  expect(await records(ds.id)).toMatchObject([{ enabled: true, revision: 1 }]);
  expect(
    (
      await request(`/${ds.id}/records/${record.id}/enabled`, "PUT", {
        enabled: false,
        expectedRevision: 1,
      })
    ).status,
  ).toBe(200);
  expect((await searchAs(clientA)).results).toHaveLength(0);
  expect(await records(ds.id)).toMatchObject([{ enabled: false }]);
  expect(
    (
      await request(`/${ds.id}/records/${record.id}/enabled`, "PUT", {
        enabled: true,
        expectedRevision: 1,
      })
    ).status,
  ).toBe(409);
  await runSync();
  expect(remove).toHaveBeenCalledWith(`${record.id}/1.md`);
  const uploads = upload.mock.calls.length;
  await request(`/${ds.id}/records/${record.id}`, "PUT", {
    categoryId: category.id,
    schemaVersion: 1,
    title: "Edited while disabled",
    data: { content: "Updated" },
    expectedRevision: 2,
  });
  await runSync();
  expect(upload).toHaveBeenCalledTimes(uploads);
  expect(
    (
      await request(`/${ds.id}/records/${record.id}/enabled`, "PUT", {
        enabled: true,
        expectedRevision: 3,
      })
    ).status,
  ).toBe(200);
  await runSync();
  search.mockResolvedValue({ chunks: [{ score: 1, item: { key: `${record.id}/4.md` } }] });
  expect((await searchAs(clientA)).results).toHaveLength(1);
});

it("drops forged, stale and deleted hits and returns only current authorized D1 records", async () => {
  const a = await createDataset("Allowed");
  const b = await createDataset("Forbidden");
  const ca = await createCategory(a.id);
  const cb = await createCategory(b.id);
  const ra = await createRecord(a.id, ca.id, "Allowed data");
  const rb = await createRecord(b.id, cb.id, "Secret");
  await request(`/${a.id}/clients`, "PUT", { clientIds: [clientA] });
  await runSync();
  search.mockResolvedValue({
    chunks: [
      { score: 0.9, text: "MALICIOUS PROVIDER CONTENT", item: { key: `${ra.id}/1.md` } },
      { score: 0.2, item: { key: `${ra.id}/1.md` } },
      { score: 1, text: "Secret", item: { key: `${rb.id}/1.md` } },
    ],
  });
  const result = await searchAs(clientA);
  expect(result).toMatchObject({ results: [{ id: ra.id, score: 0.9 }] });
  expect("results" in result && result.results).toHaveLength(1);
  expect(JSON.stringify(result)).toContain("Allowed data");
  expect(JSON.stringify(result)).not.toMatch(/Secret|MALICIOUS/);
  expect(env.DATASET_SEARCH.get).toHaveBeenLastCalledWith(a.instanceName);
  await request(`/${a.id}/records/${ra.id}`, "PUT", {
    categoryId: ca.id,
    schemaVersion: 1,
    title: "New",
    data: { content: "New data" },
    expectedRevision: 1,
  });
  expect(await searchAs(clientA)).toMatchObject({ results: [] });
  await runSync();
  expect(remove).toHaveBeenCalledWith(`${ra.id}/1.md`);
  search.mockResolvedValue({ chunks: [{ score: 1, item: { key: `${ra.id}/2.md` } }] });
  expect(JSON.stringify(await searchAs(clientA))).toContain("New data");
  await request(`/${a.id}/records/${ra.id}`, "DELETE");
  expect(await searchAs(clientA)).toMatchObject({ results: [] });
  await runSync();
  expect(remove).toHaveBeenCalledWith(`${ra.id}/2.md`);
});

it("rechecks grants after retrieval when a dataset is unbound mid-search", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  await request(`/${ds.id}/clients`, "PUT", { clientIds: [clientA] });
  await runSync();
  search.mockImplementationOnce(async () => {
    sqlite.prepare("DELETE FROM client_dataset WHERE client_id = ?").run(clientA);
    return { chunks: [{ score: 1, item: { key: `${record.id}/1.md` } }] };
  });
  expect(await searchAs(clientA)).toMatchObject({ results: [] });
});

it("never marks a deleted record ready when deletion races with indexing", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  itemInfo.mockImplementationOnce(async (id: string) => {
    await request(`/${ds.id}/records/${record.id}`, "DELETE");
    return remoteItems.get(id);
  });
  await runSync();
  expect(sqlite.prepare("SELECT status FROM dataset_search_job").get()?.status).not.toBe("ready");
  await runSync();
  expect(remove).toHaveBeenCalledWith(`${record.id}/1.md`);
});

it("does not allow a bearer-token caller to supply a client identity to the RAG tool", async () => {
  const call = (body: unknown, clientId?: string, token = "test-token") =>
    context(
      () =>
        toolsRoute.request(
          "https://test.example/api/tools/knowledge/search",
          {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify(body),
          },
          env,
        ),
      clientId,
    );
  expect((await call({ query: "X", clientId: clientA })).status).toBe(403);
  expect((await call({ query: "X", clientId: clientB }, clientA)).status).toBe(400);
  expect((await call({ query: "X" }, clientA, "wrong")).status).toBe(403);
  expect((await call({ query: "" }, clientA)).status).toBe(200);
  const invalid = await call({ query: "Walli", datasetId: "Walli Core", limit: 20 }, clientA);
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: "Invalid search input",
    guidance: expect.stringContaining('Call knowledge_search with {"query":""}'),
    issues: expect.arrayContaining([
      expect.objectContaining({ path: ["datasetId"] }),
      expect.objectContaining({ path: ["limit"] }),
    ]),
  });
});

it("deleting a dataset immediately revokes access and queues remote cleanup", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  await request(`/${ds.id}/clients`, "PUT", { clientIds: [clientA] });
  await runSync();
  await request(`/${ds.id}`, "DELETE");
  expect((await request(`/${ds.id}`)).status).toBe(404);
  expect(await searchAs(clientA)).toEqual({ results: [] });
  await runSync();
  expect(env.DATASET_SEARCH.delete).toHaveBeenCalledWith(ds.instanceName);
  for (const table of [
    "dataset",
    "dataset_record",
    "dataset_category",
    "dataset_schema",
    "client_dataset",
    "dataset_search_job",
  ])
    expect(sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n).toBe(0);
  expect((await request(`/${ds.id}/records/${record.id}`)).status).toBe(404);
});

it("validates nested schemas without coercion or executing schema code", () => {
  expect(
    dataSchema.safeParse({
      ...schema,
      properties: { content: { type: "string", pattern: "(a+)+" } },
    }).success,
  ).toBe(false);
  expect(dataSchema.safeParse({ ...schema, required: ["missing"] }).success).toBe(false);
  const nested = dataSchema.parse({
    type: "object",
    properties: {
      count: { type: "integer", minimum: 0 },
      tags: { type: "array", items: { type: "string", enum: ["a", "b"] } },
    },
  });
  expect(validateData(nested, { count: 2, tags: ["a"] })).toEqual([]);
  expect(validateData(nested, { count: "2", tags: ["c"] }).length).toBe(2);
});

it("rolls back record creation if durable indexing work cannot be written", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  sqlite.exec(
    "CREATE TRIGGER fail_outbox BEFORE INSERT ON dataset_search_job BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;",
  );
  const response = await request(`/${ds.id}/records`, "POST", {
    categoryId: category.id,
    schemaVersion: 1,
    title: "Atomic",
    data: { content: "Must not survive" },
  });
  expect(response.status).toBe(500);
  expect(await records(ds.id)).toEqual([]);
});

it("supports client-side binding management without changing other clients' grants", async () => {
  const a = await createDataset("A");
  const b = await createDataset("B");
  await request(`/${a.id}/clients`, "PUT", { clientIds: [clientA, clientB] });
  const clientRequest = (method: string, body?: unknown, role: string | null = "admin") =>
    context(() =>
      app.request(`/api/admin/clients/${clientA}/datasets`, {
        method,
        headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  expect((await clientRequest("GET", undefined, null)).status).toBe(401);
  expect((await clientRequest("PUT", { datasetIds: [a.id, b.id] })).status).toBe(200);
  expect(await (await clientRequest("GET")).json()).toEqual({
    datasetIds: expect.arrayContaining([a.id, b.id]),
  });
  await clientRequest("PUT", { datasetIds: [] });
  expect(await context(() => searchDatasets({ query: "", limit: 5 }), clientB)).toMatchObject({
    datasets: [{ id: a.id }],
  });
});

it("does not duplicate uploads while another worker owns the job lease", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  await createRecord(ds.id, category.id);
  upload.mockImplementationOnce(async (key: string) => {
    await runSync();
    const item = { id: key, key, status: "completed" };
    remoteItems.set(key, item);
    return item;
  });
  await runSync();
  expect(upload).toHaveBeenCalledTimes(1);
});

it.each([
  Object.assign(new Error("Missing"), { name: "AiSearchNotFoundError" }),
  new Error("AiSearchNotFoundError: ai_search_not_found"),
])(
  "provisions a private hybrid instance for %s and distinguishes indexing from ready",
  async (error) => {
    const ds = await createDataset();
    const category = await createCategory(ds.id);
    await createRecord(ds.id, category.id);
    const handle = env.DATASET_SEARCH.get(ds.instanceName);
    env.DATASET_SEARCH.create = vi.fn(async () => handle);
    info.mockRejectedValueOnce(error);
    itemInfo.mockResolvedValueOnce({ status: "running" });
    await runSync();
    expect(env.DATASET_SEARCH.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ds.instanceName,
        public_endpoint_params: { enabled: false },
        index_method: { vector: true, keyword: true },
      }),
    );
    expect(await records(ds.id)).toMatchObject([{ syncStatus: "indexing" }]);
    await request(`/${ds.id}/sync`, "POST");
    await runSync();
    expect(await records(ds.id)).toMatchObject([{ syncStatus: "ready" }]);
  },
);

it("reports committed data on publication failure and recovers through the retry endpoint", async () => {
  const dataset = await createDataset();
  const category = await createCategory(dataset.id);
  send.mockRejectedValueOnce(new Error("Queue unavailable"));
  const response = await request(`/${dataset.id}/records`, "POST", {
    categoryId: category.id,
    schemaVersion: 1,
    title: "Saved",
    data: { content: "Persisted" },
  });
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    persisted: true,
    retryUrl: `/api/admin/datasets/${dataset.id}/sync`,
  });
  expect(sqlite.prepare("SELECT count(*) AS count FROM dataset_record").get()?.count).toBe(1);
  expect(upload).not.toHaveBeenCalled();
  expect((await request(`/${dataset.id}/sync`, "POST")).status).toBe(202);
  await runSync();
  expect(sqlite.prepare("SELECT status FROM dataset_search_job").get()?.status).toBe("ready");
});

it("allows cleanup recovery after a dataset was deleted but publication failed", async () => {
  const dataset = await createDataset();
  const category = await createCategory(dataset.id);
  await createRecord(dataset.id, category.id);
  await runSync();
  send.mockRejectedValueOnce(new Error("Queue unavailable"));
  expect((await request(`/${dataset.id}`, "DELETE")).status).toBe(503);
  expect((await request(`/${dataset.id}/sync`, "POST", undefined, null)).status).toBe(401);
  expect((await request(`/${dataset.id}/sync`, "POST")).status).toBe(202);
  await runSync();
  expect(remoteItems.size).toBe(0);
});

it("uses delayed continuation for indexing and retries without acknowledging a failed publication", async () => {
  const dataset = await createDataset();
  const category = await createCategory(dataset.id);
  const record = await createRecord(dataset.id, category.id);
  queued = [];
  itemInfo.mockResolvedValue({ status: "running" });
  const body: DatasetSyncMessage = { type: "job", jobId: `${record.id}:1` };
  const first = await deliver(body);
  expect(first.ack).toHaveBeenCalledOnce();
  expect(first.retry).not.toHaveBeenCalled();
  expect(send).toHaveBeenLastCalledWith(body, { delaySeconds: expect.any(Number) });
  send.mockRejectedValueOnce(new Error("Queue unavailable"));
  const second = await deliver(body);
  expect(second.ack).not.toHaveBeenCalled();
  expect(second.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
  expect(upload).toHaveBeenCalledOnce();
});

it("retries provider failures and acknowledges duplicate terminal deliveries", async () => {
  const dataset = await createDataset();
  const category = await createCategory(dataset.id);
  const record = await createRecord(dataset.id, category.id);
  queued = [];
  const body: DatasetSyncMessage = { type: "job", jobId: `${record.id}:1` };
  info.mockRejectedValueOnce(new Error("Provider unavailable"));
  const failed = await deliver(body);
  expect(failed.ack).not.toHaveBeenCalled();
  expect(failed.retry).toHaveBeenCalledOnce();
  // An early redelivery must retain the retry budget, rather than republish a fresh message.
  const early = await deliver(body);
  expect(early.retry).toHaveBeenCalledOnce();
  await request(`/${dataset.id}/sync`, "POST");
  await runSync();
  const duplicate = await deliver(body);
  expect(duplicate.ack).toHaveBeenCalledOnce();
  expect(upload).toHaveBeenCalledOnce();
});

it("paginates dataset dispatch without sending another dataset's jobs", async () => {
  const dataset = await createDataset();
  const other = await createDataset();
  const category = await createCategory(dataset.id);
  const otherCategory = await createCategory(other.id);
  for (let i = 0; i < 51; i++) await createRecord(dataset.id, category.id);
  await createRecord(other.id, otherCategory.id);
  queued = [];
  await deliver({ type: "dataset", datasetId: dataset.id });
  expect(queued.filter(({ body }) => body.type === "job")).toHaveLength(50);
  const continuation = queued.find(({ body }) => body.type === "dataset")!;
  queued = [];
  await deliver(continuation.body);
  expect(queued).toHaveLength(1);
  const last = queued[0].body;
  expect(last.type).toBe("job");
  if (last.type === "job")
    expect(
      sqlite.prepare("SELECT dataset_id FROM dataset_search_job WHERE id = ?").get(last.jobId)
        ?.dataset_id,
    ).toBe(dataset.id);
});

it("creates, edits and indexes Markdown records without a user model", async () => {
  const dataset = await createDataset();
  const response = await request(`/${dataset.id}/records`, "POST", {
    title: "Guide",
    data: { content: "## Setup\n\n**Start here**" },
  });
  expect(response.status).toBe(201);
  const { id } = await response.json();
  expect(await (await request(`/${dataset.id}`)).json()).toMatchObject({ categories: [] });
  expect((await records(dataset.id))[0]).toMatchObject({
    categoryId: null,
    schemaVersion: 1,
    data: { content: "## Setup\n\n**Start here**" },
  });
  await runSync();
  expect(upload).toHaveBeenCalledWith(
    `${id}/1.md`,
    expect.stringContaining("## Setup\n\n**Start here**"),
  );
  expect(
    (
      await request(`/${dataset.id}/records/${id}`, "PUT", {
        categoryId: null,
        schemaVersion: 1,
        expectedRevision: 1,
        title: "Guide",
        data: { content: "Updated" },
      })
    ).status,
  ).toBe(200);
  expect(
    (await request(`/${dataset.id}/records`, "POST", { title: "Bad", data: { content: false } }))
      .status,
  ).toBe(400);
  expect(
    (await request(`/${dataset.id}/records`, "POST", { title: "Bad", data: { content: "" } }))
      .status,
  ).toBe(400);
  expect((await request(`/${dataset.id}/categories/${dataset.id}:markdown`, "DELETE")).status).toBe(
    400,
  );
});

it("enforces all model field types and bounds on direct API writes", async () => {
  const dataset = await createDataset();
  const modelSchema = {
    type: "object",
    properties: {
      name: { type: "string", minLength: 2, maxLength: 10 },
      price: { type: "number", minimum: 0, maximum: 100 },
      active: { type: "boolean" },
      published: { type: "string", format: "date-time" },
      body: { type: "string", format: "markdown", maxLength: 100 },
    },
    required: ["name", "price", "active", "published", "body"],
  };
  const result = await request(`/${dataset.id}/categories`, "POST", {
    name: "Product",
    schema: modelSchema,
  });
  expect(result.status).toBe(201);
  const { id } = await result.json();
  const data = {
    name: "Keyboard",
    price: 0,
    active: false,
    published: "2026-09-17T13:00:00+08:00",
    body: "**Markdown**",
  };
  const save = (values: unknown) =>
    request(`/${dataset.id}/records`, "POST", {
      categoryId: id,
      schemaVersion: 1,
      title: "Product",
      data: values,
    });
  expect((await save(data)).status).toBe(201);
  for (const invalid of [
    { price: -1 },
    { active: "false" },
    { published: "2026-02-30T00:00:00Z" },
    { published: "2026-09-17T13:00" },
    { name: "A" },
    { body: "a".repeat(101) },
  ])
    expect((await save({ ...data, ...invalid })).status).toBe(400);
  expect(
    dataSchema.safeParse({
      type: "object",
      properties: { bad: { type: "number", format: "markdown" } },
    }).success,
  ).toBe(false);
});

it("can switch between model records and Markdown while preserving version checks", async () => {
  const dataset = await createDataset();
  const category = await createCategory(dataset.id);
  const record = await createRecord(dataset.id, category.id);
  expect(
    (
      await request(`/${dataset.id}/records/${record.id}`, "PUT", {
        title: "Free text",
        categoryId: null,
        expectedRevision: 1,
        data: { content: "# Guide" },
      })
    ).status,
  ).toBe(200);
  expect((await records(dataset.id))[0].categoryId).toBeNull();
  expect(
    (
      await request(`/${dataset.id}/records/${record.id}`, "PUT", {
        title: "Structured",
        categoryId: category.id,
        schemaVersion: 1,
        expectedRevision: 2,
        data: { content: "Text" },
      })
    ).status,
  ).toBe(200);
  expect((await records(dataset.id))[0]).toMatchObject({ categoryId: category.id, revision: 3 });
});

it("paginates and searches active datasets with stable ordering and literal search terms", async () => {
  for (let i = 0; i < 15; i++) await createDataset(`Library ${i}`);
  const special = await createDataset("100%_资料");
  await request(`/${special.id}`, "PUT", { name: "100%_资料", description: "Reference guide" });
  const first = await (await request("?page=0")).json();
  const second = await (await request("?page=1")).json();
  expect(first.datasets).toHaveLength(9);
  expect(first.hasMore).toBe(true);
  expect(second.datasets).toHaveLength(7);
  expect(second.hasMore).toBe(false);
  expect(
    new Set([...first.datasets, ...second.datasets].map((d: { id: string }) => d.id)).size,
  ).toBe(16);
  const clientPage = await (await request("?page=0&pageSize=10")).json();
  const clientNext = await (await request("?page=1&pageSize=10")).json();
  expect(clientPage.datasets).toHaveLength(10);
  expect(clientPage.hasMore).toBe(true);
  expect(clientNext.datasets).toHaveLength(6);
  expect(clientNext.hasMore).toBe(false);
  expect(
    new Set([...clientPage.datasets, ...clientNext.datasets].map((d: { id: string }) => d.id)).size,
  ).toBe(16);
  expect((await request("?pageSize=1000")).status).toBe(400);
  const literal = await (await request("?q=" + encodeURIComponent("%_"))).json();
  expect(literal.datasets.map((d: { id: string }) => d.id)).toEqual([special.id]);
  expect((await (await request("?q=REFERENCE")).json()).datasets).toHaveLength(1);
  expect((await (await request("?q=" + encodeURIComponent("资料"))).json()).datasets).toHaveLength(
    1,
  );
  await request(`/${special.id}`, "DELETE");
  expect(await (await request("?q=REFERENCE")).json()).toEqual({ datasets: [], hasMore: false });
  expect((await request("?page=-1")).status).toBe(400);
  expect((await request("?page=1.5")).status).toBe(400);
  expect((await request("?q=" + "a".repeat(101))).status).toBe(400);
});

it("paginates records by ten and searches titles and name fields within the dataset", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  for (let i = 0; i < 12; i++) await createRecord(ds.id, category.id, String(i));
  const first = await (await request(`/${ds.id}/records`)).json();
  const second = await (await request(`/${ds.id}/records?page=1`)).json();
  expect(first.records).toHaveLength(10);
  expect(first.hasMore).toBe(true);
  expect(second.records).toHaveLength(2);
  expect(second.hasMore).toBe(false);
  expect(new Set([...first.records, ...second.records].map((row) => row.id)).size).toBe(12);
  const modelSchema = {
    type: "object",
    properties: { name: { type: "string" }, body: { type: "string", format: "markdown" } },
    additionalProperties: false,
  };
  const model = await (
    await request(`/${ds.id}/categories`, "POST", { name: "Shop", schema: modelSchema })
  ).json();
  const record = await (
    await request(`/${ds.id}/records`, "POST", {
      categoryId: model.id,
      schemaVersion: 1,
      title: "Tea shop",
      data: { name: "霸王茶姬%_", body: "# Tea" },
    })
  ).json();
  for (const term of ["霸王", "%_", "TEA"]) {
    const result = await (await request(`/${ds.id}/records?q=${encodeURIComponent(term)}`)).json();
    expect(result.records.map((row: { id: string }) => row.id)).toEqual([record.id]);
    expect(result.records[0].schema.properties.body.format).toBe("markdown");
  }
  const other = await createDataset();
  expect((await (await request(`/${other.id}/records?q=TEA`)).json()).records).toEqual([]);
  expect((await request(`/${ds.id}/records?page=-1`)).status).toBe(400);
  expect((await request(`/${ds.id}/records?q=${"x".repeat(101)}`)).status).toBe(400);
  await request(`/${ds.id}/records/${record.id}`, "DELETE");
  expect((await (await request(`/${ds.id}/records?q=TEA`)).json()).records).toEqual([]);
});

it("loads an edit record by ID without crossing dataset or admin boundaries", async () => {
  const ds = await createDataset();
  const other = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  const path = `/${ds.id}/records/${record.id}`;
  const response = await request(path);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    id: record.id,
    categoryId: category.id,
    revision: 1,
    data: { content: "Reference material" },
    schema,
  });
  expect((await request(`/${other.id}/records/${record.id}`)).status).toBe(404);
  expect((await request(path, "GET", undefined, null)).status).toBe(401);
  expect((await request(path, "GET", undefined, "user")).status).toBe(403);
  await request(path, "DELETE");
  expect((await request(path)).status).toBe(404);
});

it("retries instance deletion before physically deleting D1 and tolerates duplicate delivery", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  await createRecord(ds.id, category.id);
  await runSync();
  expect((await request(`/${ds.id}`, "DELETE")).status).toBe(202);
  vi.mocked(env.DATASET_SEARCH.delete).mockRejectedValueOnce(new Error("Provider unavailable"));
  const failed = await deliver({ type: "dataset", datasetId: ds.id });
  expect(failed.retry).toHaveBeenCalled();
  expect(sqlite.prepare("SELECT count(*) AS n FROM dataset_record").get()?.n).toBe(1);
  const retried = await deliver({ type: "dataset", datasetId: ds.id });
  expect(retried.ack).toHaveBeenCalled();
  expect(sqlite.prepare("SELECT count(*) AS n FROM dataset").get()?.n).toBe(0);
  expect((await deliver({ type: "dataset", datasetId: ds.id })).ack).toHaveBeenCalled();
});

it("waits for an active upload before deleting the instance and all local records", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  upload.mockImplementationOnce(async (key: string) => {
    await request(`/${ds.id}`, "DELETE");
    const waiting = await deliver({ type: "dataset", datasetId: ds.id });
    expect(waiting.ack).toHaveBeenCalled();
    expect(env.DATASET_SEARCH.delete).not.toHaveBeenCalled();
    const item = { id: key, key, status: "completed" };
    remoteItems.set(key, item);
    return item;
  });
  await deliver({ type: "job", jobId: `${record.id}:1` });
  await deliver({ type: "dataset", datasetId: ds.id });
  expect(remoteItems.size).toBe(0);
  expect(sqlite.prepare("SELECT count(*) AS n FROM dataset_record").get()?.n).toBe(0);
});

it("purges D1 when the search instance was never created", async () => {
  const ds = await createDataset();
  await createCategory(ds.id);
  await request(`/${ds.id}`, "DELETE");
  vi.mocked(env.DATASET_SEARCH.delete).mockRejectedValueOnce(
    Object.assign(new Error("Not found"), { name: "AiSearchNotFoundError" }),
  );
  expect((await deliver({ type: "dataset", datasetId: ds.id })).ack).toHaveBeenCalled();
  expect(sqlite.prepare("SELECT count(*) AS n FROM dataset_category").get()?.n).toBe(0);
});

it("recovers expired development jobs after queue messages are lost without stealing active leases", async () => {
  const ds = await createDataset();
  const category = await createCategory(ds.id);
  const record = await createRecord(ds.id, category.id);
  queued = [];
  sqlite
    .prepare(
      "UPDATE dataset_search_job SET lease_token = 'interrupted', lease_until = ? WHERE record_id = ?",
    )
    .run(Date.now() - 1000, record.id);
  await context(() => recoverDevelopmentSync(ds.id));
  expect(queued.map(({ body }) => body)).toEqual([{ type: "job", jobId: `${record.id}:1` }]);
  await runSync();
  expect(
    sqlite.prepare("SELECT status FROM dataset_search_job WHERE record_id = ?").get(record.id)
      ?.status,
  ).toBe("ready");
  queued = [];
  sqlite
    .prepare(
      "UPDATE dataset_search_job SET status = 'pending', lease_until = ? WHERE record_id = ?",
    )
    .run(Date.now() + 60000, record.id);
  await context(() => recoverDevelopmentSync(ds.id));
  expect(queued).toEqual([]);
  sqlite
    .prepare("UPDATE dataset_search_job SET status = 'error', lease_until = 0 WHERE record_id = ?")
    .run(record.id);
  await context(() => recoverDevelopmentSync(ds.id));
  expect(queued).toEqual([]);
});
