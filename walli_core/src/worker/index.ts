import { Hono } from "hono";
import { adminStatusRoute } from "./api/admin-status";
import { createAuth, type AppSession, type AppUser } from "./api/auth";
import { chatRoute } from "./api/chat";
import { clientsRoute } from "./api/clients";
import { meRoute } from "./api/me";
import { rootRoute } from "./api/root";
import { settingsRoute } from "./api/settings";
import type { AppBindings } from "./api/types";

const app = new Hono<AppBindings>();

app.use("*", async (c, next) => {
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
  .route("/", adminStatusRoute)
  .route("/", chatRoute)
  .route("/", clientsRoute)
  .route("/", settingsRoute);

export type AppType = typeof routes;

export default routes;
