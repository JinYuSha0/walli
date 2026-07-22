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
        type: "array",
        description:
          "The image HTTPS URLs or data URIs. Pass one or more image URLs/data URIs.",
        required: true,
        defaultValue: "",
      },
      {
        name: "prompt",
        type: "string",
        description:
          "Instructions and any additional message text/caption for what to identify, read, or describe in the image input.",
        required: false,
        defaultValue: "Describe the image and extract any visible text.",
      },
    ],
  },
} satisfies ToolConfig;

// Keep the tool schema optimized for callers, then adapt it to the model payload.
// Schema-valid input can run immediately; fuzzy context still falls back to the planner LLM.
export const createImageToTextModelInput = (input: Record<string, unknown>) => {
  const file = input.file;
  const prompt = input.prompt;
  const imageFiles = Array.isArray(file)
    ? file.filter((value): value is string => typeof value === "string")
    : [];

  if (imageFiles.length === 0) {
    return input;
  }

  return {
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: typeof prompt === "string" ? prompt : "",
          },
          ...imageFiles.map((imageFile) => ({
            type: "image_url",
            image_url: {
              url: imageFile,
            },
          })),
        ],
      },
    ],
  };
};

export const createImageToTextModelOutput = (result: unknown) => {
  if (typeof result === "string") {
    return result;
  }

  if (typeof result !== "object" || result === null) {
    return result;
  }

  const record = result as Record<string, unknown>;

  if (typeof record.text === "string") {
    return record.text;
  }

  const choices = record.choices;

  if (!Array.isArray(choices)) {
    return result;
  }

  const content = choices
    .map((choice) => {
      if (typeof choice !== "object" || choice === null) {
        return undefined;
      }

      const message = (choice as Record<string, unknown>).message;

      if (typeof message !== "object" || message === null) {
        return undefined;
      }

      const messageContent = (message as Record<string, unknown>).content;

      return typeof messageContent === "string" ? messageContent : undefined;
    })
    .filter((value) => value !== undefined)
    .join("\n\n");

  return content || result;
};
