import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins/admin";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import * as schema from "../../db/schema";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | string[] | null;
};

export type AppSession = {
  id: string;
  userId: string;
  expiresAt: Date;
};

const splitList = (value?: string, options?: { lowercase?: boolean }) =>
  (value ?? "")
    .split(",")
    .map((item) => {
      const trimmed = item.trim();
      return options?.lowercase === false ? trimmed : trimmed.toLowerCase();
    })
    .filter(Boolean);

export const isAdminEmail = (email: string | undefined, env: Env) =>
  !!email && splitList(env.ADMIN_EMAILS).includes(email.toLowerCase());



const isConfiguredSecret = (value: string | undefined, placeholder: string) =>
  !!value && value.trim() !== "" && value !== placeholder;

export const hasAdminRole = (user: AppUser | null, env: Env) => {
  if (!user) return false;
  const roles = Array.isArray(user.role)
    ? user.role
    : String(user.role ?? "")
        .split(",")
        .map((role) => role.trim());

  return roles.includes("admin") || isAdminEmail(user.email, env);
};

export const createAuth = (env: Env) => {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      camelCase: true,
      transaction: false,
    }),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              role: isAdminEmail(user.email, env) ? "admin" : "user",
            },
          }),
        },
      },
    },
    socialProviders: {
      ...(isConfiguredSecret(env.GOOGLE_CLIENT_ID, "replace-with-google-client-id") &&
      isConfiguredSecret(env.GOOGLE_CLIENT_SECRET, "replace-with-google-client-secret")
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: "select_account",
            },
          }
        : {}),
    },
    plugins: [
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
    ],
  });
};

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.on(["GET", "POST"], "/*", async (c) => {
  return createAuth(c.env).handler(c.req.raw);
});
