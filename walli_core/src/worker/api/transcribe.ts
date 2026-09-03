import { Hono, type Context, type MiddlewareHandler } from "hono";
import { getClientAuthSettings, getClientBasicSettings, getWebCorsSettings } from "./clients";
import { requireAdmin } from "./helper/middleware";
import type { AppBindings } from "./types";
import { verifyChatAuth } from "./chat";
import { getClientPlatformFromClientId } from "./clients";
import { transcribeVoice } from "../tools/tool-media";

const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const AUDIO_TYPES = new Set([
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/webm",
  "video/mp4",
]);

const handleCors: MiddlewareHandler<AppBindings> = async (c, next) => {
  const origin = c.req.header("origin");
  if (!origin) return next();

  const { corsAllowedOrigins } = await getWebCorsSettings(c.env.APP_KV);
  const allowed = corsAllowedOrigins.includes(origin);
  if (allowed) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Headers", "content-type");
    c.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin");
  }
  if (c.req.method === "OPTIONS") return c.body(null, allowed ? 204 : 403);
  return next();
};

const transcribe = async (c: Context<AppBindings>, form: FormData, exposeError = false) => {
  const audio = form.get("audio");
  if (!(audio instanceof File)) return c.json({ error: "An audio file is required" }, 400);

  const type = audio.type.toLowerCase().split(";", 1)[0] || "audio/webm";
  if (!AUDIO_TYPES.has(type)) return c.json({ error: "Unsupported audio type" }, 415);
  if (audio.size > MAX_AUDIO_SIZE) return c.json({ error: "Audio exceeds the 25 MB limit" }, 413);

  const bytes = new Uint8Array(await audio.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }

  try {
    const result = await transcribeVoice({ file: `data:${type};base64,${btoa(binary)}` });
    let text: unknown;
    if (typeof result === "string") text = result;
    if (typeof result === "object" && result !== null && "text" in result) text = result.text;

    if (typeof text !== "string") throw new Error("Transcription response did not include text");
    return c.json({ text });
  } catch (error) {
    console.error(error);
    return c.json(
      {
        error:
          exposeError && error instanceof Error ? error.message : "Transcription failed",
      },
      502,
    );
  }
};

export const transcribeRoute = new Hono<AppBindings>()
  .use("/api/transcribe", handleCors)
  .post("/api/transcribe", async (c) => {
    const form = await c.req.formData();
    const appId = form.get("appId");
    const userId = form.get("userId");
    const token = form.get("token");
    const platform = getClientPlatformFromClientId(typeof appId === "string" ? appId : undefined);
    if (!platform || typeof userId !== "string") return c.json({ error: "Invalid client" }, 403);

    const basicSettings = await getClientBasicSettings(c.env.APP_KV, platform);
    if (!basicSettings.enabled) return c.json({ error: "Client disabled" }, 403);

    const authSettings = await getClientAuthSettings(c.env.APP_KV, platform);
    if (!authSettings.authEnabled) {
      return c.json({ error: "Auth disabled" }, 403);
    }
    const auth = await verifyChatAuth(authSettings, {
      appId: typeof appId === "string" ? appId : undefined,
      userId,
      token: typeof token === "string" ? token : undefined,
    });
    if (!auth.authorized) return c.json({ error: "Forbidden" }, 403);

    return transcribe(c, form);
  })
  .post("/api/internal/transcribe", requireAdmin, async (c) =>
    transcribe(c, await c.req.formData(), true),
  );
