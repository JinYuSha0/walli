import { imageToTextTool } from "./image-to-text";
import { scheduledTaskTool } from "./scheduled-task";
import { textToVoiceTool } from "./text-to-voice";
import { timestampTool } from "./timestamp";
import { voiceToTextTool } from "./voice-to-text";
import type { ToolConfig } from "../const";

export const BUILT_IN_TOOLS = [
  timestampTool,
  scheduledTaskTool,
  voiceToTextTool,
  textToVoiceTool,
  imageToTextTool,
] satisfies ToolConfig[];
