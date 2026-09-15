import customBlocksReadme from "../../../../walli_chat_blocks/README.md?raw";

export const BUILT_IN_SKILLS = [{
  key: "custom-blocks",
  platforms: ["web"],
  name: "Custom Block Rendering",
  description: "Use when a web chat response benefits from recommended replies, notices, or confirmation cards.",
  content: [
    "# Web Chat Usage Guidelines",
    "Use the README below as a format reference. Emit Markdown blocks directly in responses. Do not emit installation commands or JavaScript, or wrap blocks intended for rendering in code fences.",
    "The web client registers recommended replies, notices, and confirmation cards. Use them only when appropriate, and write user-facing text in the user's language.",
    "Confirmation card submissions are not handled by the web client yet. Use cards only for previews with action.disabled set to true. Use plain questions or recommended replies when user input is needed.",
    "Rendering a block does not execute a business operation. Claim success only after an actual tool result confirms it.",
    customBlocksReadme,
  ].join("\n\n"),
}];
