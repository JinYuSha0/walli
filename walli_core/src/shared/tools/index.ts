import {
  createImageToTextModelInput,
  createImageToTextModelOutput,
  imageToTextTool,
} from "./image-to-text";
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

// Built-in tools should keep their public schema as the fastest direct-call input.
// Add an adapter here only when the model provider expects a different payload shape.
// This lets callers pass schema-valid input directly and avoids an extra planner LLM call.
export const BUILT_IN_TOOL_MODEL_INPUT_ADAPTERS = {
  [imageToTextTool.name]: createImageToTextModelInput,
} satisfies Record<string, (input: Record<string, unknown>) => Record<string, unknown>>;

export const BUILT_IN_TOOL_MODEL_OUTPUT_ADAPTERS = {
  [imageToTextTool.name]: createImageToTextModelOutput,
} satisfies Record<string, (output: unknown) => unknown>;

export const adaptBuiltInToolModelInput = (
  toolName: string,
  input: Record<string, unknown>,
) => BUILT_IN_TOOL_MODEL_INPUT_ADAPTERS[toolName]?.(input) ?? input;

export const adaptBuiltInToolModelOutput = (toolName: string, output: unknown) =>
  BUILT_IN_TOOL_MODEL_OUTPUT_ADAPTERS[toolName]?.(output) ?? output;
