interface Env {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  ADMIN_EMAILS?: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  AI_GATEWAY_ID: string;
  CF_AIG_TOKEN?: string;
  API_TOKEN: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  AI: Ai;
  DB: D1Database;
  APP_KV: KVNamespace;
  USER_DO: DurableObjectNamespace<import("./durable-objects/user").UserDO>;
}
