import { createAiGateway } from "ai-gateway-provider";
import { unified } from "ai-gateway-provider/providers/unified";
import type { Context } from "hono";
import type { AppBindings } from "../api/types";

export { generateText } from "ai";

export const createGateway = (c: Context<AppBindings>) =>
  createAiGateway({
    accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
    gateway: c.env.AI_GATEWAY_ID,
    apiKey: c.env.CF_AIG_TOKEN,
  });

export { unified };
