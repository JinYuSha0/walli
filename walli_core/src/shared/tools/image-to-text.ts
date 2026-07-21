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
        description: "The image HTTPS URL.",
        required: true,
        defaultValue: "",
      },
    ],
  },
} satisfies ToolConfig;
