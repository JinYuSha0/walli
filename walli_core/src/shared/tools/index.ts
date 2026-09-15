import {
  createImageToTextModelOutput,
  imageToTextTool,
} from "./image-to-text";
import { memorySearchTool, memorySummaryTool } from "./memory";
import { scheduledTaskTool } from "./scheduled-task";
import { textToVoiceTool } from "./text-to-voice";
import { timestampTool } from "./timestamp";
import { createVoiceToTextModelOutput, voiceToTextTool } from "./voice-to-text";
import { skillsTool } from "./skills";
import type { ToolConfig } from "../const";

export const BUILT_IN_TOOLS = [
  timestampTool,
  skillsTool,
  memorySearchTool,
  memorySummaryTool,
  scheduledTaskTool,
  voiceToTextTool,
  textToVoiceTool,
  imageToTextTool,
] satisfies ToolConfig[];

export const BUILT_IN_TOOL_MODEL_OUTPUT_ADAPTERS = {
  [voiceToTextTool.name]: createVoiceToTextModelOutput,
  [imageToTextTool.name]: createImageToTextModelOutput,
} satisfies Record<string, (output: unknown) => unknown>;

export const adaptBuiltInToolModelOutput = (toolName: string, output: unknown) =>
  BUILT_IN_TOOL_MODEL_OUTPUT_ADAPTERS[toolName]?.(output) ?? output;
