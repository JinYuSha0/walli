import { Hono } from "hono";
import { createAuth, type AppSession, type AppUser } from "./api/helper/auth";
import { chatRoute } from "./api/chat";
import { clientsRoute } from "./api/clients";
import { meRoute } from "./api/me";
import { rootRoute } from "./api/root";
import { settingsRoute } from "./api/settings";
import { telegramRoute } from "./api/telegram";
import type { AppBindings } from "./api/types";
import { createDb } from "./db/client";
import { toolsRoute } from "./tools";
export { User } from "./durable-objects/user";

const app = new Hono<AppBindings>();

app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));

  if (c.req.path.startsWith("/api/auth/")) {
    await next();
    return;
  }

  const auth = createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set("user", (session?.user ?? null) as AppUser | null);
  c.set("session", (session?.session ?? null) as AppSession | null);
  await next();
});

app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

const routes = app
  .route("/", rootRoute)
  .route("/", meRoute)
  .route("/", toolsRoute)
  .route("/", chatRoute)
  .route("/", clientsRoute)
  .route("/", telegramRoute)
  .route("/", settingsRoute);

export type AppType = typeof routes;

export default routes;
