import type { ToolConfig } from "../const";

export const imageToTextTool = {
  enabled: true,
  name: "image_to_text",
  description: "image-to-text model, output text",
  invocation: {
    type: "model",
    model: "openai/gpt-5.4-mini",
  },
  schema: {
    fields: [
      {
        name: "file",
        type: "string",
        description: "The image HTTPS URL or data URI.",
        required: true,
        defaultValue: "",
      },
      {
        name: "prompt",
        type: "string",
        description: "Instructions for what to identify, read, or describe in the image.",
        required: false,
        defaultValue: "Describe the image and extract any visible text.",
      },
    ],
  },
} satisfies ToolConfig;
