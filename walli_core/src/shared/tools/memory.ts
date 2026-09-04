import { CLIENT_PLATFORMS } from "../client";
import type { ToolConfig } from "../const";

export const memorySearchTool = {
  enabled: true,
  name: "memory_search",
  description:
    "Search the user's historical chat messages and long-term memory using FTS5 relevance search. Use this when prior conversation details may help answer the current request.",
  invocation: {
    type: "api",
    url: "/api/tools/memory/search",
    method: "POST",
    headers: [],
  },
  schema: {
    fields: [
      {
        name: "query",
        type: "string",
        description: "Search query describing the prior conversation details to retrieve.",
        required: true,
        defaultValue: "",
      },
      {
        name: "clientId",
        type: "string",
        description: "Unique client ID for the Durable Object namespace.",
        required: true,
        defaultValue: "",
      },
      {
        name: "userId",
        type: "string",
        description: "The user ID whose long-term memory should be searched.",
        required: true,
        defaultValue: "",
      },
      {
        name: "clientPlatform",
        type: "string",
        description: `Client platform for the user ID namespace. Supported values: ${CLIENT_PLATFORMS.join(", ")}.`,
        required: true,
        defaultValue: "",
      },
      {
        name: "sessionId",
        type: "string",
        description:
          "Optional chat session ID. When provided, search only this session; omit it to search all sessions for the user.",
        required: false,
        defaultValue: "",
      },
      {
        name: "limit",
        type: "number",
        description:
          "Maximum number of memory results to return. Defaults to 5 and is capped at 20.",
        required: false,
        defaultValue: "5",
      },
    ],
  },
} satisfies ToolConfig;

export const memorySummaryTool = {
  enabled: true,
  name: "memory_summary",
  description:
    "Save summarized user profile and long-term memory updates for a completed chat message window. Use this after summarizing recent conversation history into durable memory.",
  invocation: {
    type: "api",
    url: "/api/tools/memory/summary",
    method: "POST",
    headers: [],
  },
  schema: {
    fields: [
      {
        name: "clientId",
        type: "string",
        description: "Unique client ID for the Durable Object namespace.",
        required: true,
        defaultValue: "",
      },
      {
        name: "userId",
        type: "string",
        description: "The user ID whose memory summaries should be saved.",
        required: true,
        defaultValue: "",
      },
      {
        name: "clientPlatform",
        type: "string",
        description: `Client platform for the user ID namespace. Supported values: ${CLIENT_PLATFORMS.join(", ")}.`,
        required: true,
        defaultValue: "",
      },
      {
        name: "startMessageId",
        type: "string",
        description: "The first message ID included in this summary window.",
        required: true,
        defaultValue: "",
      },
      {
        name: "endMessageId",
        type: "string",
        description: "The last message ID included in this summary window.",
        required: true,
        defaultValue: "",
      },
      {
        name: "user",
        type: "string",
        description:
          "Updated user profile summary. Leave empty if the user profile does not need updating.",
        required: false,
        defaultValue: "",
      },
      {
        name: "memory",
        type: "string",
        description:
          "Updated long-term memory summary. Leave empty if long-term memory does not need updating.",
        required: false,
        defaultValue: "",
      },
    ],
  },
} satisfies ToolConfig;
