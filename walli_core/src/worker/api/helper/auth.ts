import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { createDb } from "@worker/db/client";
import * as schema from "@worker/db/schema";
import { getAsyncContext } from "@worker/lib/async-context";

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
  token?: string;
  createdAt?: Date;
  updatedAt?: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  impersonatedBy?: string | null;
};

const splitList = (value?: string, options?: { lowercase?: boolean }) =>
  (value ?? "")
    .split(",")
    .map((item) => {
      const trimmed = item.trim();
      return options?.lowercase === false ? trimmed : trimmed.toLowerCase();
    })
    .filter(Boolean);

export const isAdminEmail = (email: string | undefined) =>
  !!email && splitList(getAsyncContext().env.ADMIN_EMAILS).includes(email.toLowerCase());

const isConfiguredSecret = (value: string | undefined, placeholder: string) =>
  !!value && value.trim() !== "" && value !== placeholder;

const getTrustedOrigins = () =>
  splitList(getAsyncContext().env.BETTER_AUTH_TRUSTED_ORIGINS, { lowercase: false });

const getGoogleProvider = () => {
  const env = getAsyncContext().env;
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();

  if (
    !isConfiguredSecret(clientId, "replace-with-google-client-id") ||
    !isConfiguredSecret(clientSecret, "replace-with-google-client-secret")
  ) {
    return {};
  }

  return {
    google: {
      clientId,
      clientSecret,
      prompt: "select_account" as const,
    },
  };
};

export const hasAdminRole = (user: AppUser | null) => {
  if (!user) return false;
  const roles = Array.isArray(user.role)
    ? user.role
    : String(user.role ?? "")
        .split(",")
        .map((role) => role.trim());

  return roles.includes("admin") || isAdminEmail(user.email);
};

export const createAuth = () => {
  const env = getAsyncContext().env;
  const db = createDb();

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: getTrustedOrigins(),
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
              role: isAdminEmail(user.email) ? "admin" : "user",
            },
          }),
        },
      },
    },
    socialProviders: getGoogleProvider(),
    plugins: [
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
    ],
  });
};
