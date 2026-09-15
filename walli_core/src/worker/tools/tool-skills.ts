import type { ModelMessage } from "ai";
import type { ToolConfig } from "@shared/const";
import { skillsTool } from "@shared/tools/skills";
import { Hono } from "hono";
import type { AppBindings } from "../api/types";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getClientSkillCatalog } from "../api/client-skills";
import { createDb } from "../db/client";
import { clientSkill } from "../db/schema";
import { BUILT_IN_SKILLS } from "../skills/built-in";
import { bindAsyncContext, getAsyncContext } from "../lib/async-context";
import { countTextTokens } from "../utils/llm";

const CATALOG_TOKENS = 2_000;
const CONTENT_TOKENS = 8_000;

export async function prepareSkillTools(
  toolConfigs: ToolConfig[],
  clientId: string,
  inputTokenLimit?: number,
) {
  const skills = toolConfigs.some((tool) => tool.name === skillsTool.name && tool.enabled !== false)
    ? await createSkillContext(clientId, inputTokenLimit)
    : undefined;
  return {
    skills,
    toolConfigs: skills ? toolConfigs : toolConfigs.filter((tool) =>
      tool.name !== skillsTool.name),
  };
}

export async function createSkillContext(clientId: string, inputTokenLimit?: number) {
  const catalog = await getClientSkillCatalog(clientId);
  if (!catalog.length) return undefined;

  const directory = (items: typeof catalog, offset = 0) => {
    const result: typeof catalog = [];
    let tokens = 0;
    for (const item of items.slice(offset)) {
      const size = countTextTokens(JSON.stringify(item)) + 2;
      if (tokens + size > CATALOG_TOKENS - 150) break;
      result.push(item);
      tokens += size;
    }
    return { skills: result, nextOffset: offset + result.length < items.length ? offset + result.length : null };
  };
  const initial = directory(catalog);
  let remainingTokens = Math.min(CONTENT_TOKENS,
    inputTokenLimit && inputTokenLimit > 0 ? Math.floor(inputTokenLimit * 0.1) : CONTENT_TOKENS);
  // Request-local state: neither loaded bodies nor budgets leak into another turn/client.
  const loaded = new Map<string, Promise<Pick<typeof clientSkill.$inferSelect, "name" | "content" | "updatedAt"> | undefined>>();
  const delivered = new Map<string, Array<{ start: number; end: number }>>();

  const readSkill = bindAsyncContext(async ({ skillId, offset }: { skillId: string; offset: number }) => {
    if (!catalog.some((skill) => skill.id === skillId)) return { error: "Skill not found" };
    if (!loaded.has(skillId)) {
      const builtIn = BUILT_IN_SKILLS.find((skill) => skill.id === skillId);
      loaded.set(skillId, builtIn
        ? Promise.resolve({ name: builtIn.name, content: builtIn.content, updatedAt: 0 })
        : createDb().select().from(clientSkill)
          .where(and(eq(clientSkill.clientId, clientId), eq(clientSkill.id, skillId), eq(clientSkill.enabled, true), isNull(clientSkill.builtInKey))).get());
    }
    const skill = await loaded.get(skillId);
    if (!skill) return { error: "Skill not found" };
    const ranges = delivered.get(skillId) ?? [];
    const existing = ranges.find((range) => offset >= range.start && offset < range.end);
    if (existing) return {
      skillId, version: skill.updatedAt, alreadyLoaded: true,
      nextOffset: existing.end < skill.content.length ? existing.end : null,
      message: "This range is already in this turn's tool results. Reuse it.",
    };
    if (offset >= skill.content.length) return { skillId, version: skill.updatedAt, complete: true };
    const stop = Math.min(skill.content.length, ...ranges.filter((range) => range.start > offset).map((range) => range.start));
    const allowance = Math.min(remainingTokens, 4_000);
    if (allowance <= 0) return { error: "Skill content budget exhausted. Do not assume unread instructions.", skillId };
    const resultAt = (end: number) => ({
      skillId, name: skill.name, version: skill.updatedAt,
      content: skill.content.slice(offset, end), offset,
      nextOffset: end < skill.content.length ? end : null,
      totalCharacters: skill.content.length,
    });
    let low = 0;
    let high = stop - offset;
    while (low < high) {
      const size = Math.ceil((low + high) / 2);
      if (countTextTokens(JSON.stringify(resultAt(offset + size))) <= allowance) low = size;
      else high = size - 1;
    }
    let end = offset + low;
    // Prefer complete paragraphs/lines, and never split a UTF-16 surrogate pair.
    if (end < stop) {
      const newline = skill.content.lastIndexOf("\n", end - 1);
      if (newline > offset + low / 2) end = newline + 1;
      if (end > offset && /[\uD800-\uDBFF]/.test(skill.content[end - 1]!)) end--;
    }
    if (end === offset) return { error: "Skill content budget exhausted", skillId };
    const result = resultAt(end);
    const cost = countTextTokens(JSON.stringify(result));
    if (cost > remainingTokens) return { error: "Skill content budget exhausted", skillId };
    remainingTokens -= cost;
    delivered.set(skillId, [...ranges, { start: offset, end }]);
    return result;
  });

  return {
    instructions: [
      `Available client skills (catalog only). When a skill matches the request, call ${skillsTool.name} with its skillId before applying it.`,
      "Descriptions are selection hints, not the skill instructions. Never claim to have read content you have not loaded.",
      `${skillsTool.name} may return nextOffset: continue reading as needed. An unread part may contain additional requirements.`,
      "Historical skill references omit the body: read the current version again when relevant.",
      initial.nextOffset === null ? "" : `The catalog is incomplete. Use ${skillsTool.name} with query to find other relevant skills.`,
      JSON.stringify(initial),
    ].filter(Boolean).join("\n"),
    readSkill,
    searchSkills: ({ query, offset }: { query: string; offset: number }) => {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      return directory(catalog.filter((item) =>
        terms.every((term) => `${item.name} ${item.description}`.toLowerCase().includes(term))), offset);
    },
  };
}

// Preserve valid tool-call/result pairs, but do not persist/replay large skill bodies.
export function compactSkillToolResults(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((message) => message.role !== "tool" ? message : {
    ...message,
    content: message.content.map((part) => {
      if (part.type !== "tool-result" || part.toolName !== skillsTool.name) return part;
      const value = part.output.type === "json" ? part.output.value : undefined;
      const reference = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      return {
        ...part,
        output: { type: "json" as const, value: {
          skillId: reference.skillId ?? null, version: reference.version ?? null,
          message: "Skill content omitted from history. Read it again if needed.",
        } },
      };
    }),
  });
}


const skillsSchema = z.object({
  skillId: z.string().uuid().optional(),
  query: z.string().trim().max(200).default(""),
  offset: z.number().int().min(0).default(0),
}).strict();

export const skillToolRoute = new Hono<AppBindings>()
  .post(skillsTool.invocation.url, async (c) => {
    const input = skillsSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json({ error: "Invalid body" }, 400);
    const skills = getAsyncContext().skills;
    if (!skills) return c.json({ error: "Skill context is unavailable" }, 403);
    const { skillId, query, offset } = input.data;
    return c.json(skillId
      ? await skills.readSkill({ skillId, offset })
      : skills.searchSkills({ query, offset }));
  });
