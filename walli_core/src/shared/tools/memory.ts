import { CLIENT_PLATFORMS } from "../client";
import type { ToolConfig } from "../const";

export const memoryTool = {
  enabled: true,
  name: "memory",
  description:
    "Search the user's long-term chat memory using FTS5 relevance search. Use this when prior conversation details may help answer the current request.",
  invocation: {
    type: "api",
    url: "/api/tools/memory",
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
        description: "Maximum number of memory results to return. Defaults to 5 and is capped at 20.",
        required: false,
        defaultValue: "5",
      },
    ],
  },
} satisfies ToolConfig;
