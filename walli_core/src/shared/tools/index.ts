import { scheduledTaskTool } from "./scheduled-task";
import { timestampTool } from "./timestamp";
import type { ToolConfig } from "../const";

export const BUILT_IN_TOOLS = [timestampTool, scheduledTaskTool] satisfies ToolConfig[];
