import { prepareSkillTools, createSkillContext, compactSkillToolResults } from "../tools/tool-skills";
import { countTextTokens, sanitizeModelMessageHistory } from "../utils/llm";
import type { ModelMessage } from "ai";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { Hono } from "hono";
import { createChatRunnerTools } from "../lib/chat-runner";
import { toolsRoute } from "../tools";
import { DEFAULT_SETTINGS } from "@shared/const";
import { runWithChatAsyncContext } from "../lib/async-context";
import { clientSkillsRoute, getClientSkillCatalog } from "./client-skills";
import type { AppBindings } from "./types";

let sqlite: DatabaseSync;
let env: Env;
let queries: string[];
let kvReads: number;
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const app = new Hono<AppBindings>().use("*", async (c, next) => {
  const role = c.req.header("x-test-role");
  if (role) c.set("user", { id: "admin", role } as AppBindings["Variables"]["user"]);
  await next();
}).route("/", clientSkillsRoute);
const request = (clientId: string, method = "GET", body?: unknown, id = "", role: string | null = "admin") =>
  runWithChatAsyncContext({ env, origin: "https://test.example" }, () =>
    app.request(`https://test.example/api/admin/clients/${clientId}/skills${id ? `/${id}` : ""}`, {
      method, headers: { "Content-Type": "application/json", ...(role ? { "x-test-role": role } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
const catalog = (clientId: string) =>
  runWithChatAsyncContext({ env, origin: "https://test.example" }, () => getClientSkillCatalog(clientId));

beforeEach(() => {
  queries = [];
  kvReads = 0;
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(readFileSync("migrations/0000_initial.sql", "utf8"));
  sqlite.prepare("INSERT INTO client VALUES (?, ?, ?, ?, 1, 1)").run(a, "A", "a", "telegram");
  sqlite.prepare("INSERT INTO client VALUES (?, ?, ?, ?, 1, 1)").run(b, "B", "b", "telegram");
  const prepare = (sql: string, values: SQLInputValue[] = []) => ({
    bind: (...args: SQLInputValue[]) => prepare(sql, args),
    raw: async () => {
      queries.push(sql);
      const statement = sqlite.prepare(sql);
      statement.setReturnArrays(true);
      return statement.all(...values);
    },
    all: async () => ({ results: sqlite.prepare(sql).all(...values), success: true }),
    run: async () => ({ results: [], success: true, meta: sqlite.prepare(sql).run(...values) }),
  });
  const kv = new Map<string, string>();
  env = { API_TOKEN: "test-api-token", DB: { prepare }, APP_KV: {
    get: async (key: string) => { kvReads++; return JSON.parse(kv.get(key) ?? "null"); },
    put: async (key: string, value: string) => { kv.set(key, value); },
  } } as unknown as Env;
});
afterEach(() => sqlite.close());

it("persists skills and uses current contents only in the owning client's context", async () => {
  expect(await catalog(a)).toEqual([]);
  const response = await request(a, "POST", { name: " Support ", content: " Ask for the order number. " });
  expect(response.status).toBe(201);
  const skill = await response.json() as { id: string };
  expect(await (await request(a)).json()).toMatchObject([{ id: skill.id, name: "Support", content: "Ask for the order number." }]);
  expect(await catalog(a)).toEqual([{ id: skill.id, name: "Support", description: "" }]);
  expect(await catalog(b)).toEqual([]);
  expect((await request(a, "PUT", { name: "Returns", content: "Explain the return policy." }, skill.id)).status).toBe(200);
  expect(await catalog(a)).toEqual([{ id: skill.id, name: "Returns", description: "" }]);
  expect((await request(a, "DELETE", undefined, skill.id)).status).toBe(200);
  expect(await catalog(a)).toEqual([]);
});

it("rejects cross-client edits and deletes, and cascades removal with a client", async () => {
  const skill = await (await request(a, "POST", { name: "One", content: "Content" })).json() as { id: string };
  expect((await request(b, "PUT", { name: "Changed", content: "Changed" }, skill.id)).status).toBe(404);
  expect((await request(b, "DELETE", undefined, skill.id)).status).toBe(404);
  expect(await catalog(a)).toEqual([{ id: skill.id, name: "One", description: "" }]);
  sqlite.prepare("DELETE FROM client WHERE id = ?").run(a);
  expect(sqlite.prepare("SELECT count(*) AS count FROM client_skill").get()?.count).toBe(0);
});

it("requires admin access and validates client and skill inputs", async () => {
  expect((await request(a, "GET", undefined, "", null)).status).toBe(401);
  expect((await request(a, "POST", { name: "A", content: "B" }, "", "user")).status).toBe(403);
  expect((await request("invalid")).status).toBe(400);
  expect((await request("33333333-3333-4333-8333-333333333333")).status).toBe(404);
  for (const body of [{ name: "", content: "B" }, { name: "A", content: " " }, { name: "A", content: "B", clientId: b }]) {
    expect((await request(a, "POST", body)).status).toBe(400);
  }
  expect(await (await request(a)).json()).toEqual([]);
});

const context = async (clientId: string, budget?: number) => {
  const skills = await runWithChatAsyncContext({ env, origin: "https://test.example" }, () => createSkillContext(clientId, budget));
  if (!skills) return undefined;
  const tools = runWithChatAsyncContext({ env, origin: "https://test.example", skills }, () => createChatRunnerTools(DEFAULT_SETTINGS));
  return { ...skills, tools };
};
const read = async (ctx: NonNullable<Awaited<ReturnType<typeof context>>>, skillId: string, offset = 0) =>
  await ctx.tools.skills.execute!({ skillId, offset }, { toolCallId: "read", messages: [] });

it("loads descriptions by default, reads on demand once per turn, and reloads edited skills next turn", async () => {
  const skill = await (await request(a, "POST", {
    name: "Refund", description: "Use for refund requests", content: "Private detailed refund instructions.",
  })).json() as { id: string };
  const other = await (await request(b, "POST", { name: "Other", description: "Other client", content: "Other secret" })).json() as { id: string };
  const ctx = (await context(a))!;
  expect(ctx.instructions).toContain("Use for refund requests");
  expect(ctx.instructions).not.toContain("Private detailed");
  expect(ctx.instructions).not.toContain(other.id);
  expect(await ctx.tools.skills.execute!({}, { toolCallId: "browse", messages: [] }))
    .toMatchObject({ skills: [{ id: skill.id, name: "Refund" }], nextOffset: null });
  expect(await read(ctx, other.id)).toMatchObject({ error: "Skill not found" });
  const results = await Promise.all([read(ctx, skill.id), read(ctx, skill.id)]);
  expect(results[0]).toMatchObject({ content: "Private detailed refund instructions.", nextOffset: null });
  expect(results[1]).toMatchObject({ alreadyLoaded: true });
  expect(results[1]).not.toHaveProperty("content");
  await request(a, "PUT", { name: "Refund", description: "Refund", content: "Updated rules" }, skill.id);
  expect(await read((await context(a))!, skill.id)).toMatchObject({ content: "Updated rules" });
  await request(a, "DELETE", undefined, skill.id);
  expect(await context(a)).toBeUndefined();
});

it("bounds the catalog and makes omitted skills discoverable", async () => {
  for (let index = 0; index < 120; index++) {
    await request(a, "POST", { name: `Skill ${index}`, description: "Use for " + "detailed task ".repeat(15), content: "Body" });
  }
  const ctx = (await context(a))!;
  expect(countTextTokens(ctx.instructions)).toBeLessThanOrEqual(2_000);
  expect(ctx.tools.skills).toBeDefined();
  const result = await ctx.tools.skills!.execute!({ query: "Skill 119", offset: 0 }, { toolCallId: "search", messages: [] });
  expect(result).toMatchObject({ skills: [{ name: "Skill 119" }], nextOffset: null });
});

it("pages large skill bodies without duplicate text or exceeding the per-turn budget", async () => {
  const content = "Complete instruction line.\n".repeat(2500);
  const skill = await (await request(a, "POST", { name: "Long", description: "Long workflow", content })).json() as { id: string };
  const ctx = (await context(a, 10_000))!; // 1,000 token budget.
  const first = await read(ctx, skill.id) as { content: string; nextOffset: number };
  expect(first.content.length).toBeGreaterThan(0);
  expect(first.content).toBe(content.slice(0, first.nextOffset));
  expect(countTextTokens(JSON.stringify(first))).toBeLessThanOrEqual(1_000);
  expect(first.nextOffset).toBeLessThan(content.length);
  const second = await read(ctx, skill.id, first.nextOffset);
  expect(second).toMatchObject({ error: expect.stringContaining("budget exhausted") });
  expect(await read(ctx, skill.id)).toMatchObject({ alreadyLoaded: true });
});

it("keeps tool call pairs but removes skill bodies from history", () => {
  const messages: ModelMessage[] = [
    { role: "assistant", content: [{ type: "tool-call", toolCallId: "read-1", toolName: "skills", input: { skillId: a } }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: "read-1", toolName: "skills",
      output: { type: "json", value: { skillId: a, version: 10, content: "Large private instructions" } } }] },
    { role: "assistant", content: "Final answer" },
  ];
  const compact = compactSkillToolResults(messages);
  expect(JSON.stringify(compact)).not.toContain("Large private instructions");
  expect(JSON.stringify(compact)).toContain(a);
  expect(JSON.stringify(compact)).toContain('"version":10');
  expect(sanitizeModelMessageHistory(compact)).toEqual(compact);
  expect(JSON.stringify(messages)).toContain("Large private instructions");
});

it("continues a multi-page skill without gaps and keeps each turn's budget independent", async () => {
  const content = "Validate input and preserve every required step.\n".repeat(650).trim();
  const skill = await (await request(a, "POST", { name: "Procedure", description: "A procedure", content })).json() as { id: string };
  const ctx = (await context(a))!;
  let offset: number | null = 0;
  let reconstructed = "";
  let tokens = 0;
  let pages = 0;
  while (offset !== null && pages < 4) {
    const page = await read(ctx, skill.id, offset) as { content: string; nextOffset: number | null };
    expect(page.content).toBeTypeOf("string");
    reconstructed += page.content;
    tokens += countTextTokens(JSON.stringify(page));
    offset = page.nextOffset;
    pages++;
  }
  expect(pages).toBeGreaterThan(1);
  expect(reconstructed).toBe(content);
  expect(tokens).toBeLessThanOrEqual(8_000);
  expect(await read((await context(a))!, skill.id)).toHaveProperty("content");
});

it("uses the built-in settings, descriptions and exclusions for skill tools", () => {
  runWithChatAsyncContext({ env, origin: "https://test.example" }, () => {
    const tools = createChatRunnerTools({
      ...DEFAULT_SETTINGS,
      builtInTools: DEFAULT_SETTINGS.builtInTools.map((tool) =>
        tool.name === "skills" ? { ...tool, description: "Configured skills" } : tool),
    });
    expect(tools.skills?.description).toBe("Configured skills");
    const excluded = createChatRunnerTools(DEFAULT_SETTINGS, ["skills"]);
    expect(excluded.skills).toBeUndefined();
  });
});

it("rejects unauthenticated, context-free and invalid skill API requests", async () => {
  const skill = await (await request(a, "POST", { name: "One", content: "Secret" })).json() as { id: string };
  const ctx = (await context(a))!;
  const call = (body: unknown, token?: string, skills?: typeof ctx) =>
    runWithChatAsyncContext({ env, origin: "https://test.example", skills }, () =>
      toolsRoute.request("https://test.example/api/tools/skills", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { authorization: token } : {}) },
        body: JSON.stringify(body),
      }, env));
  expect((await call({ skillId: skill.id }, undefined, ctx)).status).toBe(403);
  expect((await call({ skillId: skill.id }, "Bearer test-api-token")).status).toBe(403);
  expect((await call({ skillId: skill.id, clientId: b }, "Bearer test-api-token", ctx)).status).toBe(400);
  expect((await call({ skillId: skill.id, offset: -1 }, "Bearer test-api-token", ctx)).status).toBe(400);
  expect((await call({ skillId: skill.id }, "Bearer test-api-token", ctx)).status).toBe(200);
});

it("isolates concurrently invoked tools and budgets across clients and turns", async () => {
  const first = await (await request(a, "POST", { name: "A", content: "Client A rules" })).json() as { id: string };
  const second = await (await request(b, "POST", { name: "B", content: "Client B rules" })).json() as { id: string };
  const [one, two, next] = await Promise.all([context(a), context(b), context(a)]);
  const results = await Promise.all([read(one!, first.id), read(two!, second.id), read(next!, first.id)]);
  expect(results).toMatchObject([{ content: "Client A rules" }, { content: "Client B rules" }, { content: "Client A rules" }]);
  expect(await read(two!, first.id)).toMatchObject({ error: "Skill not found" });
});

it("prepares skill availability from tool configuration without changing unrelated tools", async () => {
  const prepare = (configs = DEFAULT_SETTINGS.builtInTools) =>
    runWithChatAsyncContext({ env, origin: "https://test.example" }, () => prepareSkillTools(configs, a));
  const empty = await prepare();
  expect(empty.skills).toBeUndefined();
  expect(empty.toolConfigs.map((tool) => tool.name)).not.toContain("skills");
  expect(empty.toolConfigs.map((tool) => tool.name)).toContain("timestamp");
  await request(a, "POST", { name: "One", content: "Instructions" });
  const enabled = await prepare();
  expect(enabled.skills).toBeDefined();
  expect(enabled.toolConfigs).toBe(DEFAULT_SETTINGS.builtInTools);
  const disabled = await prepare(DEFAULT_SETTINGS.builtInTools.map((tool) =>
    tool.name === "skills" ? { ...tool, enabled: false } : tool));
  expect(disabled.skills).toBeUndefined();
  expect(disabled.toolConfigs.map((tool) => tool.name)).not.toContain("skills");
  const excluded = await prepare(DEFAULT_SETTINGS.builtInTools.filter((tool) => tool.name !== "skills"));
  expect(excluded.skills).toBeUndefined();
});

it("disables custom skills without losing content and blocks reads of disabled skills", async () => {
  const skill = await (await request(a, "POST", { name: "Toggle", content: "Keep this" })).json() as { id: string };
  const pending = (await context(a))!;
  expect((await request(a, "PUT", { enabled: false }, skill.id)).status).toBe(200);
  expect(await catalog(a)).toEqual([]);
  expect(await read(pending, skill.id)).toMatchObject({ error: "Skill not found" });
  expect(await (await request(a)).json()).toMatchObject([{ id: skill.id, enabled: false, content: "Keep this", builtInKey: null }]);
  await request(a, "PUT", { name: "Renamed" }, skill.id);
  expect(await catalog(a)).toEqual([]);
  await request(a, "PUT", { enabled: true }, skill.id);
  expect(await read((await context(a))!, skill.id)).toMatchObject({ content: "Keep this" });
  expect((await request(a, "DELETE", undefined, skill.id)).status).toBe(200);
});

it("reads built-in content from code and persists only its switch in KV", async () => {
  sqlite.prepare("UPDATE client SET platform = 'web' WHERE id = ?").run(a);
  const lists = await Promise.all([request(a), request(a)]);
  const skills = await lists[0]!.json() as Array<{ id: string; builtInKey: string; content: string }>;
  expect(skills).toHaveLength(1);
  const skill = skills[0]!;
  expect(skill.builtInKey).toBe("custom-blocks");
  expect(skill.content).toContain(":::notice info");
  expect(skill.content).toContain(":::recommended-replies");
  expect(skill.content).toContain(":::confirmation-card");
  expect(skill.content).toBe(readFileSync("../walli_chat_blocks/README.md", "utf8"));
  expect(await (await request(b)).json()).toEqual([]);
  expect(await catalog(a)).toMatchObject([{ id: skill.id }]);
  expect((await request(a, "DELETE", undefined, skill.id)).status).toBe(403);
  expect((await request(b, "DELETE", undefined, skill.id)).status).toBe(404);
  for (const input of [{ name: "Changed" }, { description: "Changed" }, { content: "Changed" }, { enabled: false, content: "Changed" }]) {
    expect((await request(a, "PUT", input, skill.id)).status).toBe(403);
  }
  expect(await catalog(a)).toMatchObject([{ id: skill.id }]);
  expect((await request(b, "PUT", { enabled: false }, skill.id)).status).toBe(404);
  expect((await request(a, "PUT", { enabled: false }, skill.id)).status).toBe(200);
  expect(await catalog(a)).toEqual([]);
  expect(sqlite.prepare("SELECT count(*) AS count FROM client_skill").get()!.count).toBe(0);
  expect(skill.content).toContain("Always include `format`");
  expect(await (await request(a)).json()).toMatchObject([{ id: skill.id, enabled: false, content: skill.content, builtInKey: "custom-blocks" }]);
  expect((await request(a, "PUT", { builtInKey: null }, skill.id)).status).toBe(400);
  expect((await request(a, "POST", { name: "Fake", content: "Fake", builtInKey: "custom-blocks" })).status).toBe(400);
  await request(a, "PUT", { enabled: true }, skill.id);
  expect(await read((await context(a))!, skill.id)).toMatchObject({ content: skill.content });
});


it("uses one metadata query and one KV read per catalog, with no database reads for built-in bodies", async () => {
  sqlite.prepare("UPDATE client SET platform = 'web' WHERE id = ?").run(a);
  const ctx = (await context(a))!;
  expect(queries).toHaveLength(1);
  expect(queries[0]).not.toContain('"content"');
  expect(kvReads).toBe(1);
  const [{ id }] = ctx.searchSkills({ query: "", offset: 0 }).skills;
  await read(ctx, id);
  expect(queries).toHaveLength(1);
  expect(kvReads).toBe(1);
  expect(sqlite.prepare("SELECT count(*) AS count FROM client_skill").get()!.count).toBe(0);
});

it("preserves legacy switches without reading or rewriting stored built-in content", async () => {
  sqlite.prepare("UPDATE client SET platform = 'web' WHERE id = ?").run(a);
  const legacyId = crypto.randomUUID();
  sqlite.prepare("INSERT INTO client_skill (id, client_id, name, content, built_in_key, enabled, created_at, updated_at) VALUES (?, ?, 'Old skill', 'Outdated instructions', 'custom-blocks', 0, 1, 1)")
    .run(legacyId, a);
  expect(await catalog(a)).toEqual([]);
  const [skill] = await (await request(a)).json() as Array<{ id: string; content: string; enabled: boolean }>;
  expect(skill.enabled).toBe(false);
  expect(skill.content).toContain("Always include `format`");
  await request(a, "PUT", { enabled: true }, legacyId);
  expect(await catalog(a)).toMatchObject([{ id: skill.id }]);
  expect(sqlite.prepare("SELECT content, enabled FROM client_skill").get()).toMatchObject({ content: "Outdated instructions", enabled: 0 });
});


it("skips skill storage entirely when the tool is disabled", async () => {
  await runWithChatAsyncContext({ env, origin: "https://test.example" }, () => prepareSkillTools(
    DEFAULT_SETTINGS.builtInTools.map((tool) => ({ ...tool, enabled: false })), a,
  ));
  expect(queries).toEqual([]);
  expect(kvReads).toBe(0);
});

it("keeps built-in switches isolated between web clients", async () => {
  sqlite.prepare("UPDATE client SET platform = 'web'").run();
  const [skill] = await catalog(a);
  await request(a, "PUT", { enabled: false }, skill.id);
  expect(await catalog(a)).toEqual([]);
  expect(await catalog(b)).toMatchObject([{ id: skill.id }]);
  expect(await read((await context(b))!, skill.id)).toHaveProperty("content");
});
