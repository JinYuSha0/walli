import { Hono } from "hono";
import { validator } from "hono/validator";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { BUILT_IN_SKILLS } from "../skills/built-in";
import { clientSkillInputSchema, clientSkillPatchSchema } from "@shared/client";
import { createDb } from "@worker/db/client";
import { client, clientSkill } from "@worker/db/schema";
import type { AppBindings } from "./types";
import { requireAdmin } from "./helper/middleware";

const ensureBuiltInSkills = async (clientId: string) => {
  const db = createDb();
  const owner = await db.select({ platform: client.platform }).from(client).where(eq(client.id, clientId)).get();
  if (!owner) return;
  const definitions = BUILT_IN_SKILLS.filter((skill) => skill.platforms.includes(owner.platform));
  if (!definitions.length) return;
  const existing = await db.select({ key: clientSkill.builtInKey }).from(clientSkill)
    .where(eq(clientSkill.clientId, clientId)).all();
  const missing = definitions.filter((skill) => !existing.some((item) => item.key === skill.key));
  if (!missing.length) return;
  const now = Date.now();
  await db.insert(clientSkill).values(missing.map((skill) => ({
    id: crypto.randomUUID(), clientId, builtInKey: skill.key,
    name: skill.name, description: skill.description, content: skill.content,
    enabled: true, createdAt: now, updatedAt: now,
  }))).onConflictDoNothing({ target: [clientSkill.clientId, clientSkill.builtInKey] }).run();
};

export const getClientSkills = async (clientId: string) => {
  await ensureBuiltInSkills(clientId);
  return createDb().select().from(clientSkill).where(eq(clientSkill.clientId, clientId))
    .orderBy(asc(clientSkill.createdAt), asc(clientSkill.id)).all();
};

export const getClientSkillCatalog = async (clientId: string) => {
  await ensureBuiltInSkills(clientId);
  return createDb().select({
    id: clientSkill.id, name: clientSkill.name, description: clientSkill.description,
  }).from(clientSkill).where(and(eq(clientSkill.clientId, clientId), eq(clientSkill.enabled, true)))
    .orderBy(asc(clientSkill.createdAt), asc(clientSkill.id)).all();
};

const validateSkill = validator("json", (value, c) => {
  const result = clientSkillInputSchema.safeParse(value);
  return result.success ? result.data : c.json({ error: "Invalid skill" }, 400);
});

const validateSkillPatch = validator("json", (value, c) => {
  const result = clientSkillPatchSchema.safeParse(value);
  return result.success ? result.data : c.json({ error: "Invalid skill" }, 400);
});

export const clientSkillsRoute = new Hono<AppBindings>()
  .use("/api/admin/clients/:clientId/skills/*", requireAdmin)
  .use("/api/admin/clients/:clientId/skills/*", async (c, next) => {
    const clientId = z.uuid().safeParse(c.req.param("clientId"));
    if (!clientId.success) return c.json({ error: "Invalid client ID" }, 400);
    const found = await createDb().select({ id: client.id }).from(client)
      .where(eq(client.id, clientId.data)).get();
    if (!found) return c.json({ error: "Client not found" }, 404);
    await next();
  })
  .get("/api/admin/clients/:clientId/skills", async (c) =>
    c.json(await getClientSkills(c.req.param("clientId"))))
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
    const existing = await db.select({ builtInKey: clientSkill.builtInKey }).from(clientSkill)
      .where(and(eq(clientSkill.clientId, c.req.param("clientId")), eq(clientSkill.id, c.req.param("skillId")))).get();
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
