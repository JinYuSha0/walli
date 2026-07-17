interface Env {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  ADMIN_EMAILS?: string;
  APP_KV: KVNamespace;
}
