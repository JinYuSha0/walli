/// <reference path="../src/vite-env.d.ts" />

import type { Preview } from "@storybook/vue3-vite";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import walliChatBlocksThemeCss from "../../walli_chat_blocks/src/theme.css?inline";
import "../src/theme.css";
import { docsPage } from "../.storybook/docs-page";

const style = document.createElement("style");
style.dataset.walliStorybook = "true";
style.textContent = `${walliChatUnoCss}\n${walliChatBlocksThemeCss}`;
document.head.append(style);

const preview: Preview = {
  parameters: {
    a11y: { test: "todo" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      canvas: { sourceState: "shown" },
      page: docsPage,
      toc: true,
    },
    layout: "centered",
    options: {
      storySort: {
        method: "custom",
        order: [
          "Vue",
          [
            "Chat",
            [
              "Full Chat Bottom Padding",
              "Full Chat Stick To Bottom",
              "Actions",
              "Conversation",
              "Reasoning Stream",
              "Time Messages",
              "Rich Markdown",
              "User Message",
              "Assistant Message",
              "Image Message",
              "Custom Block",
              "Repalce Block",
              "Theme Toggle",
              "Scroll Controls",
              "Initial Index",
              "Insert Messages",
              "Replace Message",
              "Delete Messages",
              "Edit Message",
              "Load Older At Top",
              "Load Newer At Bottom",
            ],
            "Chat Composer",
            "Custom Blocks",
          ],
        ],
      },
    },
  },
  decorators: [
    (story) => {
      document.documentElement.style.colorScheme = "light";
      return story();
    },
  ],
};

export default preview;
