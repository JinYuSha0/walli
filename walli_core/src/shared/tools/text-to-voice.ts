import type { ToolConfig } from "../const";

export const textToVoiceTool = {
  enabled: true,
  name: "text_to_voice",
  description: "text-to-speech model, output audio url",
  invocation: {
    type: "model",
    model: "openai/tts-1",
  },
  schema: {
    fields: [
      {
        name: "text",
        type: "string",
        description: "The text to generate audio for. Maximum length is 4096 characters.",
        required: true,
        defaultValue: "",
      },
      {
        name: "voice",
        type: "string",
        description: "The voice to use when generating the audio. Defaults to alloy.",
        required: false,
        defaultValue: "alloy",
      },
      {
        name: "response_format",
        type: "string",
        description:
          "The output format for the audio. Supported formats are mp3, opus, wav, aac and flac.",
        required: false,
        defaultValue: "mp3",
      },
      {
        name: "speed",
        type: "number",
        description:
          "The speed of the generated audio. Select a value from 0.25 to 4.0. 1.0 is the default.",
        required: false,
        defaultValue: "1",
      },
    ],
  },
} satisfies ToolConfig;
