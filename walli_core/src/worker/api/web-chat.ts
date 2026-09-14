import { webChatTurnstileAction } from "@shared/turnstile";
import { verifyTurnstile } from "./helper/turnstile";
import { hasGoogleAccount } from "./helper/auth";
import { Hono } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod";
import { clientDialogSettingsSchema } from "@shared/client";
import type { AppBindings } from "./types";
import {
  getClientBySlug,
  getClientBasicSettings,
  getClientWebSettings,
  getClientDialogSettings,
} from "./clients";
import { getChatHistoryPage, streamChat } from "./chat";
import { getAsyncContext } from "@worker/lib/async-context";
import { createUserDoName } from "@worker/durable-objects/user/types";
import { createChatUserInfo } from "@worker/lib/chat-runner";
import { createTemporaryAssetUrl } from "@worker/utils/llm";
import { upload } from "./upload";
import { transcribe } from "./transcribe";
import { isMultiSessionClient } from "./settings";

type WebBindings = AppBindings & {
  Variables: AppBindings["Variables"] & {
    webClient: NonNullable<Awaited<ReturnType<typeof getClientBySlug>>>;
    webDialog: Awaited<ReturnType<typeof getClientDialogSettings>>;
    webUserId: string;
    webAuthInfo: unknown;
    webPrompt: string;
  };
};
const publicDialogSchema = clientDialogSettingsSchema.strip();
const historyQuery = z.object({ cursor: z.coerce.number().int().positive().optional() });
const sessionsQuery = z.object({
  cursor: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    },
    z
      .object({ createdAt: z.number().int().nonnegative(), id: z.string().min(1).max(200) })
      .strict()
      .optional(),
  ),
});
const messageBody = z.object({ content: z.string().trim().min(1).max(100_000) }).strict();

// Only sign this visitor's own stored images, including when restoring old history.
async function refreshImages(markdown: string, userId: string, origin: string) {
  const matches = [...markdown.matchAll(/https?:\/\/[^\s)]+\/api\/assets\/[^\s)]+/g)];
  for (const [value] of matches) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      continue;
    }
    if (url.origin !== origin || !url.pathname.startsWith(`/api/assets/${userId}/image/`)) continue;
    markdown = markdown.replace(
      value,
      await createTemporaryAssetUrl(value, origin, getAsyncContext().env.API_TOKEN),
    );
  }
  return markdown;
}

export const webChatRoute = new Hono<WebBindings>()
  .use("/api/web-chat/:slug/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    const origin = new URL(c.req.url).origin;
    if (
      c.req.method !== "GET" &&
      ((c.req.header("Origin") && c.req.header("Origin") !== origin) ||
        c.req.header("Sec-Fetch-Site") === "cross-site")
    ) {
      return c.json({ error: "Forbidden origin" }, 403);
    }
    const client = await getClientBySlug(c.req.param("slug")!);
    if (!client || client.platform !== "web") return c.json({ error: "Chat not found" }, 404);
    const [basic, dialog, web] = await Promise.all([
      getClientBasicSettings(client.id),
      getClientDialogSettings(client.id),
      getClientWebSettings(client.id),
    ]);
    if (!basic.enabled) return c.json({ error: "Client disabled" }, 401);
    if (!web.webAccessEnabled) return c.json({ error: "Chat not found" }, 404);
    c.set("webClient", client);
    c.set("webDialog", dialog);
    c.set("webPrompt", basic.additionalSystemPrompt);
    const cookieName = `walli_chat_${client.id.replaceAll("-", "")}`;
    const secret = getAsyncContext().env.API_TOKEN;
    const isConfig = c.req.method === "GET" && c.req.path === `/api/web-chat/${c.req.param("slug")}/config`;
    let userId: string | undefined;
    if (web.loginMethod === "google") {
      const user = c.get("user");
      if (user && await hasGoogleAccount(user.id)) {
        userId = `web_${client.id}_google_${user.id}`;
        c.set("webAuthInfo", { id: user.id, name: user.name, email: user.email });
      }
    } else {
      let visitor = await getSignedCookie(c, secret, cookieName);
      // Preserve existing visitors; new visitors use a device-derived identifier.
      const validVisitor = (value: string | false | undefined): value is string =>
        typeof value === "string" && (z.uuid().safeParse(value).success || /^[a-f0-9]{64}$/.test(value));
      if (!validVisitor(visitor) && isConfig) {
        const fingerprint = c.req.header("X-Chat-Device");
        if (!fingerprint || !/^[a-f0-9]{64}$/.test(fingerprint))
          return c.json({ error: "Device identifier required" }, 400);
        visitor = fingerprint;
        await setSignedCookie(c, cookieName, visitor, secret, {
          httpOnly: true, secure: new URL(c.req.url).protocol === "https:",
          sameSite: "Strict", path: "/api/web-chat", maxAge: 365 * 86400,
        });
      }
      if (validVisitor(visitor)) userId = `web_${client.id}_${visitor}`;
    }
    if (isConfig) {
      return c.json({
        id: client.id, name: client.name, slug: client.slug,
        loginMethod: web.loginMethod,
        authenticated: !!userId,
        turnstileEnabled: web.turnstileEnabled,
        turnstileSiteKey: web.turnstileEnabled ? getAsyncContext().env.TURNSTILE_SITE_KEY : undefined,
        userImage: web.loginMethod === "google" && userId ? c.get("user")?.image : undefined,
        userName: web.loginMethod === "google" && userId ? c.get("user")?.name : undefined,
        userId,
        multiSession: await isMultiSessionClient("web"),
        dialogSettings: publicDialogSchema.parse(dialog),
      });
    }
    if (!userId) return c.json({ error: "Authentication required" }, 401);
    c.set("webUserId", userId);
    const action = webChatTurnstileAction(c.req.method, c.req.path.slice(`/api/web-chat/${client.slug}`.length));
    if (web.turnstileEnabled && action && !(await verifyTurnstile(
      c.req.header("X-Turnstile-Token"), action, client.id,
      new URL(c.req.url).hostname, c.req.header("CF-Connecting-IP"),
    ))) return c.json({ error: "Bot verification failed" }, 403);
    await next();
  })
  .get("/api/web-chat/:slug/config", (c) => c.body(null))
  .get("/api/web-chat/:slug/sessions", async (c) => {
    const client = c.get("webClient");
    const store = getAsyncContext().env.USER_DO.getByName(
      createUserDoName(client.id, "web", c.get("webUserId")),
    );
    const query = sessionsQuery.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "Invalid cursor" }, 400);
    return c.json(await store.listSessionsPage({ cursor: query.data.cursor, limit: 10 }));
  })
  .post("/api/web-chat/:slug/sessions", async (c) => {
    const client = c.get("webClient");
    const store = getAsyncContext().env.USER_DO.getByName(
      createUserDoName(client.id, "web", c.get("webUserId")),
    );
    return c.json(await store.createSession({ clientId: client.id }), 201);
  })
  .get("/api/web-chat/:slug/sessions/:sessionId", async (c) => {
    const client = c.get("webClient");
    const userId = c.get("webUserId");
    const store = getAsyncContext().env.USER_DO.getByName(
      createUserDoName(client.id, "web", userId),
    );
    const session = await store.getSession(c.req.param("sessionId"));
    if (!session) return c.json({ error: "Session not found" }, 404);
    const query = historyQuery.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "Invalid cursor" }, 400);
    const page = await getChatHistoryPage({
      clientId: client.id,
      clientPlatform: "web",
      userId,
      sessionId: c.req.param("sessionId"),
      cursor: query.data.cursor,
      limit: 30,
    });
    return c.json({
      ...page,
      session,
      messages: await Promise.all(
        page.messages.map(async (message) => ({
          ...message,
          markdown: await refreshImages(message.markdown, userId, new URL(c.req.url).origin),
        })),
      ),
    });
  })
  .delete("/api/web-chat/:slug/sessions/:sessionId", async (c) => {
    const client = c.get("webClient");
    const store = getAsyncContext().env.USER_DO.getByName(
      createUserDoName(client.id, "web", c.get("webUserId")),
    );
    if (!(await store.getSession(c.req.param("sessionId"))))
      return c.json({ error: "Session not found" }, 404);
    return c.json(await store.softDeleteSession(c.req.param("sessionId")));
  })
  .post("/api/web-chat/:slug/sessions/:sessionId/messages", async (c) => {
    const client = c.get("webClient");
    const userId = c.get("webUserId");
    const dialog = c.get("webDialog");
    const body = messageBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid message" }, 400);
    const text = body.data.content.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
    if (text.length > dialog.dialogInputMaxLength)
      return c.json({ error: "Message exceeds input limit" }, 400);
    if (!dialog.dialogImageEnabled && /!\[[^\]]*\]\([^)]+\)/.test(body.data.content))
      return c.json({ error: "Images disabled" }, 400);
    const store = getAsyncContext().env.USER_DO.getByName(
      createUserDoName(client.id, "web", userId),
    );
    if (!(await store.getSession(c.req.param("sessionId"))))
      return c.json({ error: "Session not found" }, 404);
    return streamChat(
      c,
      {
        sessionId: c.req.param("sessionId"),
        messages: [{ role: "user", content: body.data.content }],
      },
      createChatUserInfo({ clientId: client.id, userId, authUserInfo: c.get("webAuthInfo") }),
      "web",
      c.get("webPrompt"),
    );
  })
  .post("/api/web-chat/:slug/image", async (c) => {
    if (!c.get("webDialog").dialogImageEnabled) return c.json({ error: "Images disabled" }, 403);
    const response = await upload(c, "image", c.get("webUserId"));
    if (response.status !== 201) return response;
    const asset = (await response.json()) as { url: string };
    return c.json(
      {
        ...asset,
        url: await createTemporaryAssetUrl(
          asset.url,
          new URL(c.req.url).origin,
          getAsyncContext().env.API_TOKEN,
        ),
      },
      201,
    );
  })
  .post("/api/web-chat/:slug/transcribe", async (c) => {
    if (!c.get("webDialog").dialogSpeechEnabled) return c.json({ error: "Speech disabled" }, 403);
    return transcribe(c, await c.req.formData());
  });
