import { createAiGateway } from "ai-gateway-provider";
import { createUnified } from "ai-gateway-provider/providers/unified";
import { getAsyncContext } from "./async-context";

export const createGateway = () => {
  const env = getAsyncContext().env;
  return createAiGateway({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    gateway: env.AI_GATEWAY_ID,
    apiKey: env.CF_AIG_TOKEN,
  });
};

export const normalizeGatewayModelId = (model: string) => {
  const value = model.trim();

  if (value.startsWith("@cf/")) {
    return `workers-ai/${value}`;
  }

  return value;
};

export const unified = (modelId: string) =>
  createUnified({
    includeUsage: true,
    supportsStructuredOutputs: modelId.startsWith("openai/"),
  })(modelId);
