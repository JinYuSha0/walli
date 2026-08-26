import type { WalliChatMessage } from "../src/react";

export const fullChatWelcomeMessages: WalliChatMessage[] = [
  {
    id: "react-welcome",
    role: "assistant",
    markdown: [
      "## Welcome to Walli",
      "",
      "This React story combines the message timeline with the complete Composer.",
      "",
      "- Send a message to see streaming Markdown",
      "- Add image or file attachments",
      "- Try the action menu",
      "- Allow microphone access to test transcription",
    ].join("\n"),
  },
];
