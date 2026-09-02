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
        order: ["Vue", ["Chat", "Chat Composer", "Custom Blocks"]],
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
