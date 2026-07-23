import { CLIENT_PLATFORMS } from "../client";
import type { ToolConfig } from "../const";

export const scheduledTaskTool = {
  enabled: true,
  name: "scheduled_task",
  description:
    "Create, list, or cancel scheduled tasks for a user. Supports one-time tasks and recurring tasks with 5-field cron expressions.",
  invocation: {
    type: "api",
    url: "/api/tools/scheduled-tasks",
    method: "POST",
    headers: [],
  },
  schema: {
    fields: [
      {
        name: "action",
        type: "string",
        description: "Operation to perform: create, list, or cancel.",
        required: true,
        defaultValue: "",
      },
      {
        name: "userId",
        type: "string",
        description:
          "The user ID whose Durable Object stores the scheduled task. Notifications for the task are sent to this same ID.",
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
        name: "taskId",
        type: "string",
        description: "The task ID to cancel. Required when action is cancel.",
        required: false,
        defaultValue: "",
      },
      {
        name: "status",
        type: "string",
        description:
          "Task status to query when action=list: pending, completed, failed, canceled, or all. Defaults to pending. Ended task queries (completed, failed, canceled, or all) return at most 20 tasks.",
        required: false,
        defaultValue: "pending",
      },
      {
        name: "type",
        type: "string",
        description: "Task type for action=create. Defaults to generic.",
        required: false,
        defaultValue: "generic",
      },
      {
        name: "description",
        type: "string",
        description: "Concrete description of what the scheduled task should do. Required when action is create.",
        required: false,
        defaultValue: "",
      },
      {
        name: "payload",
        type: "object",
        description:
          'JSON payload for action=create. Use an empty object if no payload is needed. When the task should notify with a specific media type, preserve it here, for example {"notificationType":"voice"} for voice/audio replies or {"notificationType":"image","image":"https://..."} for image replies.',
        required: false,
        defaultValue: "{}",
      },
      {
        name: "scheduledAt",
        type: "number",
        description:
          "Unix timestamp in milliseconds for action=create. Use for absolute one-time tasks. For relative tasks like 'in 5 minutes', prefer delayMs because scheduled_task resolves it against the tool server's current time.",
        required: false,
        defaultValue: "",
      },
      {
        name: "delayMs",
        type: "number",
        description:
          "Relative delay in milliseconds for action=create. Use this instead of calling the timestamp tool when the user asks for a one-time task relative to now, such as in 30 seconds, in 5 minutes, or after 2 hours. The scheduled_task tool adds this value to its own current server time.",
        required: false,
        defaultValue: "",
      },
      {
        name: "cron",
        type: "string",
        description:
          "Optional 5-field cron expression for recurring tasks: minute hour dayOfMonth month dayOfWeek. Example: 0 17 1 * *.",
        required: false,
        defaultValue: "",
      },
      {
        name: "timeZone",
        type: "string",
        description: "IANA time zone used to evaluate cron expressions. Defaults to UTC.",
        required: false,
        defaultValue: "UTC",
      },
      {
        name: "recurrenceEndAt",
        type: "number",
        description:
          "Optional Unix timestamp in milliseconds after which no further recurring tasks should be created.",
        required: false,
        defaultValue: "",
      },
      {
        name: "maxRuns",
        type: "number",
        description: "Optional maximum number of runs for a recurring task, including the first run.",
        required: false,
        defaultValue: "",
      },
      {
        name: "maxRetry",
        type: "number",
        description:
          "Maximum total attempts for each task run, including the first attempt. Defaults to 1, which means no retry.",
        required: false,
        defaultValue: "1",
      },
    ],
  },
} satisfies ToolConfig;
