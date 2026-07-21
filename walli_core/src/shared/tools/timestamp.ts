import type { ToolConfig } from "../const";

export const timestampTool = {
  enabled: true,
  name: "timestamp",
  description:
    "Get the current Unix timestamp and formatted date time for any IANA time zone. Use the returned datetime directly instead of converting it yourself.",
  invocation: {
    type: "api",
    url: "/api/tools/timestamp",
    method: "GET",
    headers: [],
  },
  schema: {
    fields: [
      {
        name: "timeZone",
        type: "string",
        description:
          "Optional IANA time zone, for example UTC, Asia/Shanghai, America/New_York, or Europe/London. Defaults to UTC.",
        required: false,
        defaultValue: "UTC",
      },
    ],
  },
} satisfies ToolConfig;
