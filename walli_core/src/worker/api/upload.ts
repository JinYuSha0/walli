import { Hono, type Context } from "hono";
import { z } from "zod";
import { requireAdmin, requireUser } from "./helper/middleware";
import { errorResponseSchema, parseResponse } from "./helper/validation";
import type { AppBindings } from "./types";
import { getAsyncContext } from "@worker/lib/async-context";
import { hasValidTemporaryAssetUrl } from "../utils/llm";

const MB = 1024 * 1024;
const uploadRules = {
  file: {
    maxSize: 25 * MB,
    types: new Set([
      "application/msword",
      "application/pdf",
      "application/rtf",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/csv",
      "text/markdown",
      "text/plain",
    ]),
  },
  image: {
    maxSize: 10 * MB,
    types: new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]),
  },
} as const;

type AssetKind = keyof typeof uploadRules;

const uploadResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    size: z.number().int().nonnegative(),
    type: z.string(),
    url: z.string(),
  })
  .strict();

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export const uploadRoute = new Hono<AppBindings>()
  .post("/api/admin/assistant-avatar", requireAdmin, async (c) => {
    const body = await c.req.raw.formData().catch(() => null);
    const file = body?.get("file");
    if (!(file instanceof File) || file.size === 0) return c.json({ error: "An image is required" }, 400);
    if (file.size > 2 * MB) return c.json({ error: "Avatar exceeds the 2 MB limit" }, 413);
    if (!uploadRules.image.types.has(file.type) || !(await hasValidImageSignature(file, file.type))) {
      return c.json({ error: "Invalid image content or type" }, 415);
    }
    const id = crypto.randomUUID();
    await getAsyncContext().env.R2.put(`assistant-avatars/${id}`, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    return c.json({ url: `/api/assistant-avatars/${id}` }, 201);
  })
  .get("/api/assistant-avatars/:id", async (c) => {
    const id = z.uuid().safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "Avatar not found" }, 404);
    const object = await getAsyncContext().env.R2.get(`assistant-avatars/${id.data}`);
    if (!object) return c.json({ error: "Avatar not found" }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { headers });
  })
  .post("/api/upload/image", requireUser, (c) => upload(c, "image"))
  .post("/api/upload/file", requireUser, (c) => upload(c, "file"))
  .get("/api/assets/:clientId/:userId/:kind/:id", readAsset)
  .get("/api/assets/:userId/:kind/:id", readAsset);

async function readAsset(c: Context<AppBindings>) {
  const clientId = c.req.param("clientId");
  const ownerId = c.req.param("userId");
  const hasTemporaryAccess = await hasValidTemporaryAssetUrl(
    getAsyncContext().env.API_TOKEN,
    c.req.path,
    c.req.query("expires"),
    c.req.query("signature"),
  );
  const user = c.get("user");
  if (!user && !hasTemporaryAccess) {
    return c.json(parseResponse(errorResponseSchema, { error: "Unauthorized" }), 401);
  }
  if (!hasTemporaryAccess && user?.id !== ownerId) {
    return c.json(parseResponse(errorResponseSchema, { error: "File not found" }), 404);
  }

  const kind = parseAssetKind(c.req.param("kind"));
  if (!kind) {
    return c.json(parseResponse(errorResponseSchema, { error: "File not found" }), 404);
  }

  const object = await getAsyncContext().env.R2.get(createObjectKey(ownerId, kind, c.req.param("id")!, clientId));
  if (!object || object.customMetadata?.userId !== ownerId || (clientId && object.customMetadata?.clientId !== clientId)) {
    return c.json(parseResponse(errorResponseSchema, { error: "File not found" }), 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Content-Length", object.size.toString());
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");

  const name = object.customMetadata?.name;
  if (name) {
    headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
  }

  return new Response(object.body, { headers });
}

export async function upload<E extends AppBindings>(c: Context<E>, kind: AssetKind, ownerId = c.get("user")!.id, clientId?: string) {
  const body = await c.req.raw.formData().catch(() => null);
  const file = body?.get("file");

  if (!(file instanceof File)) {
    return c.json(
      parseResponse(errorResponseSchema, { error: 'A file is required in the "file" field' }),
      400,
    );
  }

  const rule = uploadRules[kind];
  const contentType = file.type.toLowerCase();
  if (!rule.types.has(contentType)) {
    return c.json(parseResponse(errorResponseSchema, { error: `Unsupported ${kind} type` }), 415);
  }
  if (file.size > rule.maxSize) {
    return c.json(
      parseResponse(errorResponseSchema, {
        error: `${capitalize(kind)} exceeds the ${rule.maxSize / MB} MB limit`,
      }),
      413,
    );
  }
  if (kind === "image" && !(await hasValidImageSignature(file, contentType))) {
    return c.json(parseResponse(errorResponseSchema, { error: "Invalid image content" }), 415);
  }

  const id = crypto.randomUUID();
  const key = createObjectKey(ownerId, kind, id, clientId);
  await getAsyncContext().env.R2.put(key, file.stream(), {
    customMetadata: { kind, name: file.name, userId: ownerId, ...(clientId ? { clientId } : {}) },
    httpMetadata: { contentType },
  });

  return c.json(
    parseResponse(uploadResponseSchema, {
      id,
      name: file.name,
      size: file.size,
      type: contentType,
      url: new URL(`/api/assets/${clientId ? `${encodeURIComponent(clientId)}/` : ""}${encodeURIComponent(ownerId)}/${kind}/${id}`, c.req.url).toString(),
    }),
    201,
  );
}

function createObjectKey(userId: string, kind: AssetKind, id: string, clientId?: string): string {
  return `uploads/${clientId ? `${clientId}/` : ""}${userId}/${kind}s/${id}`;
}

function parseAssetKind(value: string): AssetKind | null {
  return value === "image" || value === "file" ? value : null;
}

async function hasValidImageSignature(file: File, contentType: string): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = new TextDecoder();

  switch (contentType) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.length >= 8 && bytes
        .slice(0, 8)
        .every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
    case "image/gif":
      return (
        text.decode(bytes.slice(0, 6)) === "GIF87a" || text.decode(bytes.slice(0, 6)) === "GIF89a"
      );
    case "image/webp":
      return (
        text.decode(bytes.slice(0, 4)) === "RIFF" && text.decode(bytes.slice(8, 12)) === "WEBP"
      );
    default:
      return false;
  }
}
