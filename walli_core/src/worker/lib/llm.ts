import { createAiGateway } from "ai-gateway-provider";
import { unified } from "ai-gateway-provider/providers/unified";
import type { Context } from "hono";
import type { AppBindings } from "../api/types";

export { generateText } from "ai";

export const createGatewayFromEnv = (env: Env) =>
  createAiGateway({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    gateway: env.AI_GATEWAY_ID,
    apiKey: env.CF_AIG_TOKEN,
  });

export const createGateway = (c: Context<AppBindings>) => createGatewayFromEnv(c.env);

export const normalizeGatewayModelId = (model: string) => {
  const value = model.trim();

  if (value.startsWith("@cf/")) {
    return `workers-ai/${value}`;
  }

  return value;
};

export { unified };
