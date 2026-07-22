import type { ToolConfig } from "../const";

export const textToVoiceTool = {
  enabled: true,
  name: "text_to_voice",
  description: "text-to-speech model, output audio url",
  invocation: {
    type: "model",
    model: "inworld/tts-2",
  },
  schema: {
    fields: [
      {
        name: "text",
        type: "string",
        description: "The text to be synthesized into speech. Maximum input of 2,000 characters.",
        required: true,
        defaultValue: "",
      },
      {
        name: "voice_id",
        type: "string",
        description: "The ID of the voice to use for synthesizing speech. Defaults to Ashley.",
        required: false,
        defaultValue: "Ashley",
      },
      {
        name: "output_format",
        type: "string",
        description:
          "The output format for the audio. Supported formats are mp3, opus, wav, and flac. Defaults to mp3.",
        required: false,
        defaultValue: "mp3",
      },
      {
        name: "temperature",
        type: "number",
        description:
          "Determines the degree of randomness when sampling audio tokens. Defaults to 1.0.",
        required: false,
        defaultValue: "1",
      },
      {
        name: "timestamp_type",
        type: "string",
        description:
          'Controls timestamp metadata returned with the audio. Use "none", "word", or "character". Defaults to none.',
        required: false,
        defaultValue: "none",
      },
    ],
  },
} satisfies ToolConfig;
