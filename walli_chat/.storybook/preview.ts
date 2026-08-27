import type { Preview } from "@storybook/web-components-vite";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import "../src/theme.css";

const style = document.createElement("style");
style.dataset.walliStorybook = "true";
style.textContent = walliChatUnoCss;
document.head.append(style);

const preview: Preview = {
  parameters: {
    a11y: {
      test: "todo",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      canvas: {
        sourceState: "shown",
      },
      toc: true,
    },
    layout: "centered",
    options: {
      storySort: {
        method: "custom",
        order: ["Components", ["Chat Message", "Chat Composer", "Custom Blocks"]],
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
