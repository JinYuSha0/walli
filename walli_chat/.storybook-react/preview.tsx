import type { Preview } from "@storybook/react-vite";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import "../src/theme.css";

const style = document.createElement("style");
style.dataset.walliStorybook = "true";
style.textContent = walliChatUnoCss;
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
      toc: true,
    },
    layout: "centered",
    options: {
      storySort: {
        method: "custom",
        order: ["React", ["Chat", "Chat Composer"]],
      },
    },
  },
  decorators: [
    (Story) => {
      document.documentElement.style.colorScheme = "light";
      return <Story />;
    },
  ],
};

export default preview;
