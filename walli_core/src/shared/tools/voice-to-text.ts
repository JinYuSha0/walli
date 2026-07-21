import type { ToolConfig } from "../const";

export const voiceToTextTool = {
  enabled: true,
  name: "voice_to_text",
  description: "A speech-to-text model, output text",
  invocation: {
    type: "model",
    model: "openai/gpt-4o-transcribe",
  },
  schema: {
    fields: [
      {
        name: "file",
        type: "string",
        description:
          "The audio file as a data URI (data:audio/...;base64,...) or HTTPS URL. Supported formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm.",
        required: true,
        defaultValue: "",
      },
      {
        name: "language",
        type: "string",
        description:
          "language string The language of the input audio. Supplying the input language in ISO-639-1 format will improve accuracy and latency.",
        required: false,
        defaultValue: "",
      },
      {
        name: "prompt",
        type: "string",
        description:
          "An optional text to guide the model's style or continue a previous audio segment. The prompt should match the audio language.",
        required: false,
        defaultValue: "",
      },
      {
        name: "temperature",
        type: "number",
        description:
          "The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. Defaults to 0 if omitted.",
        required: false,
        defaultValue: "",
      },
    ],
  },
} satisfies ToolConfig;
