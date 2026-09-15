import { Hono } from "hono";
import { validator } from "hono/validator";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { BUILT_IN_SKILLS, clientSkillSettingsKey, getBuiltInClientSkills } from "../skills/built-in";
import { getAsyncContext } from "../lib/async-context";
import { clientSkillInputSchema, clientSkillPatchSchema } from "@shared/client";
import { createDb } from "@worker/db/client";
import { client, clientSkill } from "@worker/db/schema";
import type { AppBindings } from "./types";
import { requireAdmin } from "./helper/middleware";

export const getClientSkills = async (clientId: string, platform: string) => {
  const [rows, settings] = await Promise.all([
    createDb().select().from(clientSkill).where(eq(clientSkill.clientId, clientId))
      .orderBy(asc(clientSkill.createdAt), asc(clientSkill.id)).all(),
    getAsyncContext().env.APP_KV.get<Record<string, boolean>>(clientSkillSettingsKey(clientId), "json"),
  ]);
  return [...getBuiltInClientSkills(clientId, platform, settings, rows), ...rows.filter((row) => row.builtInKey === null)];
};

export const getClientSkillCatalog = async (clientId: string) => {
  // Join the owner in the metadata query; never initialize or synchronize skills during a turn.
  const [rows, settings] = await Promise.all([
    createDb().select({
      platform: client.platform,
      skill: {
        id: clientSkill.id, name: clientSkill.name, description: clientSkill.description,
        enabled: clientSkill.enabled, builtInKey: clientSkill.builtInKey,
      },
    }).from(client).leftJoin(clientSkill, eq(clientSkill.clientId, client.id))
      .where(eq(client.id, clientId)).orderBy(asc(clientSkill.createdAt), asc(clientSkill.id)).all(),
    getAsyncContext().env.APP_KV.get<Record<string, boolean>>(clientSkillSettingsKey(clientId), "json"),
  ]);
  if (!rows.length) return [];
  const custom = rows.flatMap((row) => row.skill ? [row.skill] : []);
  return [
    ...getBuiltInClientSkills(clientId, rows[0]!.platform, settings, custom),
    ...custom.filter((skill) => skill.builtInKey === null),
  ].filter((skill) => skill.enabled).map(({ id, name, description }) => ({ id, name, description }));
};

const validateSkill = validator("json", (value, c) => {
  const result = clientSkillInputSchema.safeParse(value);
  return result.success ? result.data : c.json({ error: "Invalid skill" }, 400);
});

const validateSkillPatch = validator("json", (value, c) => {
  const result = clientSkillPatchSchema.safeParse(value);
  return result.success ? result.data : c.json({ error: "Invalid skill" }, 400);
});

export const clientSkillsRoute = new Hono<AppBindings & { Variables: { skillClientPlatform: string } }>()
  .use("/api/admin/clients/:clientId/skills/*", requireAdmin)
  .use("/api/admin/clients/:clientId/skills/*", async (c, next) => {
    const clientId = z.uuid().safeParse(c.req.param("clientId"));
    if (!clientId.success) return c.json({ error: "Invalid client ID" }, 400);
    const found = await createDb().select({ id: client.id, platform: client.platform }).from(client)
      .where(eq(client.id, clientId.data)).get();
    if (!found) return c.json({ error: "Client not found" }, 404);
    c.set("skillClientPlatform", found.platform);
    await next();
  })
  .get("/api/admin/clients/:clientId/skills", async (c) =>
    c.json(await getClientSkills(c.req.param("clientId"), c.get("skillClientPlatform"))))
  .post("/api/admin/clients/:clientId/skills", validateSkill, async (c) => {
    const now = Date.now();
    const [skill] = await createDb().insert(clientSkill).values({
      ...c.req.valid("json"), id: crypto.randomUUID(), clientId: c.req.param("clientId"),
      createdAt: now, updatedAt: now,
    }).returning();
    return c.json(skill!, 201);
  })
  .put("/api/admin/clients/:clientId/skills/:skillId", validateSkillPatch, async (c) => {
    const db = createDb();
    const input = c.req.valid("json");
    const definition = BUILT_IN_SKILLS.find((skill) => skill.id === c.req.param("skillId"));
    const existing = definition ? undefined : await db.select({ builtInKey: clientSkill.builtInKey }).from(clientSkill)
      .where(and(eq(clientSkill.clientId, c.req.param("clientId")), eq(clientSkill.id, c.req.param("skillId")))).get();
    const builtIn = definition ?? BUILT_IN_SKILLS.find((skill) => skill.key === existing?.builtInKey);
    if (builtIn) {
      if (!builtIn.platforms.includes(c.get("skillClientPlatform"))) return c.json({ error: "Skill not found" }, 404);
      if (Object.keys(input).some((key) => key !== "enabled")) return c.json({ error: "Built-in skills only support enabling or disabling" }, 403);
      const key = clientSkillSettingsKey(c.req.param("clientId"));
      const kv = getAsyncContext().env.APP_KV;
      const settings = await kv.get<Record<string, boolean>>(key, "json") ?? {};
      settings[builtIn.key] = input.enabled!;
      await kv.put(key, JSON.stringify(settings));
      return c.json(getBuiltInClientSkills(c.req.param("clientId"), c.get("skillClientPlatform"), settings, [])
        .find((skill) => skill.id === builtIn.id)!);
    }
    if (!existing) return c.json({ error: "Skill not found" }, 404);
    if (existing.builtInKey && Object.keys(input).some((key) => key !== "enabled")) {
      return c.json({ error: "Built-in skills only support enabling or disabling" }, 403);
    }
    const [skill] = await db.update(clientSkill)
      .set({ ...input, updatedAt: Date.now() })
      .where(and(eq(clientSkill.clientId, c.req.param("clientId")), eq(clientSkill.id, c.req.param("skillId"))))
      .returning();
    return skill ? c.json(skill) : c.json({ error: "Skill not found" }, 404);
  })
  .delete("/api/admin/clients/:clientId/skills/:skillId", async (c) => {
    const builtIn = BUILT_IN_SKILLS.find((skill) => skill.id === c.req.param("skillId"));
    if (builtIn) {
      if (!builtIn.platforms.includes(c.get("skillClientPlatform"))) return c.json({ error: "Skill not found" }, 404);
      return c.json({ error: "Built-in skills cannot be deleted" }, 403);
    }
    const db = createDb();
    const scope = and(eq(clientSkill.clientId, c.req.param("clientId")), eq(clientSkill.id, c.req.param("skillId")));
    const existing = await db.select({ builtInKey: clientSkill.builtInKey }).from(clientSkill).where(scope).get();
    if (!existing) return c.json({ error: "Skill not found" }, 404);
    if (existing.builtInKey) return c.json({ error: "Built-in skills cannot be deleted" }, 403);
    const [skill] = await db.delete(clientSkill)
      .where(and(scope, isNull(clientSkill.builtInKey)))
      .returning({ id: clientSkill.id });
    return skill ? c.json({ ok: true }) : c.json({ error: "Skill not found" }, 404);
  });
