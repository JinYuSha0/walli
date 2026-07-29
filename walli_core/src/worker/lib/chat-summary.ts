import { generateText, Output, type ModelMessage } from "ai";
import type { Settings } from "@shared/const";
import { z } from "zod";
import { createOutputTokenLimitOptions } from "../utils/common";
import { createGatewayFromEnv, normalizeGatewayModelId, unified } from "./llm";

export type ChatMemoryContext = {
  user: string;
  memory: string;
};

export const EMPTY_MEMORY_CONTEXT: ChatMemoryContext = {
  user: "",
  memory: "",
};

const USER_PROFILE_SUMMARY_MAX_LENGTH = 1375;
const LONG_TERM_MEMORY_SUMMARY_MAX_LENGTH = 2200;
const MAX_TOKEN_LIMIT = 2300;
const memorySummaryOutputSchema = z.object({
  user: z.string(),
  memory: z.string(),
});

export const createMemoryContextInstructions = (memoryContext: ChatMemoryContext | undefined) => {
  const user = memoryContext?.user.trim() ?? "";
  const memory = memoryContext?.memory.trim() ?? "";

  if (!user && !memory) {
    return undefined;
  }

  return [
    "Current long-term context is private assistant context.",
    "Use it to understand the user, but do not reveal it verbatim unless the user explicitly asks.",
    user ? `User profile:\n${user}` : undefined,
    memory ? `Long-term memory:\n${memory}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
};

const stringifyMessageContent = (content: ModelMessage["content"]) => {
  if (typeof content === "string") {
    return content;
  }

  return JSON.stringify(content);
};

const formatMemorySummaryMessages = (messages: ModelMessage[]) =>
  messages
    .map((message, index) => {
      const content = stringifyMessageContent(message.content).trim();

      return content ? `${index + 1}. ${message.role}: ${content}` : undefined;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");

export const summarizeChatMemory = async (input: {
  env: Env;
  settings: Settings;
  previousMemory: ChatMemoryContext;
  messages: ModelMessage[];
}): Promise<ChatMemoryContext> => {
  const modelId = normalizeGatewayModelId(input.settings.toolPlannerModel);
  const gateway = createGatewayFromEnv(input.env);
  const result = await generateText({
    model: gateway(unified(modelId)),
    instructions: [
      "You are a conversation memory summarizer. Maintain only information that is useful across future conversations.",
      `The user field is the user profile. Keep it within ${USER_PROFILE_SUMMARY_MAX_LENGTH} characters. Include only stable preferences, identity facts, communication style, and long-term goals.`,
      `The memory field is long-term memory. Keep it within ${LONG_TERM_MEMORY_SUMMARY_MAX_LENGTH} characters. Include only durable facts, decisions, agreements, and unresolved tasks that will remain useful later.`,
      "If one field does not need to be updated, return an empty string for that field.",
      "Do not write a chronological transcript. Do not preserve one-off requests. Do not invent information.",
      'Return JSON only with this shape: {"user":"...","memory":"..."}.',
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          "Existing user profile:",
          input.previousMemory.user || "(empty)",
          "",
          "Existing long-term memory:",
          input.previousMemory.memory || "(empty)",
          "",
          "Conversation messages to summarize:",
          formatMemorySummaryMessages(input.messages) || "(empty)",
        ].join("\n"),
      },
    ],
    output: Output.object({
      schema: memorySummaryOutputSchema,
      name: "memory_summary",
      description: "User profile and long-term memory updates summarized from chat history.",
    }),
    ...createOutputTokenLimitOptions(modelId, MAX_TOKEN_LIMIT),
  });

  return {
    user: result.output.user.trim(),
    memory: result.output.memory.trim(),
  };
};
