import type { MiddlewareHandler } from "hono";
import { getClientById, getWebCorsSettings } from "../clients";
import type { AppBindings } from "../types";

export const handleCors = ({
  methods = ["POST", "DELETE", "OPTIONS"],
  headers = ["content-type", "authorization", "x-client-id"],
}: {
  methods?: string[];
  headers?: string[];
} = {}): MiddlewareHandler<AppBindings> => async (c, next) => {
  const origin = c.req.header("origin");
  if (!origin) return next();

  const clientId = c.req.header("x-client-id");
  const client = clientId ? await getClientById(clientId) : undefined;
  const settings = client?.platform === "web" ? await getWebCorsSettings(client.id) : undefined;
  const allowed = settings?.corsAllowedOrigins.includes(origin) ?? false;

  if (allowed) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Headers", headers.join(", "));
    c.header("Access-Control-Allow-Methods", methods.join(", "));
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin");
  }

  if (c.req.method === "OPTIONS") return c.body(null, allowed ? 204 : 403);
  await next();
};
