import { Hono } from "hono";
import { adminStatusRoute } from "./api/admin-status";
import { authRoutes, createAuth, type AppSession, type AppUser } from "./api/auth";
import { meRoute } from "./api/me";
import { rootRoute } from "./api/root";
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

app.route("/api/auth", authRoutes);
app.route("/", rootRoute);
app.route("/", meRoute);
app.route("/", adminStatusRoute);

export default app;
