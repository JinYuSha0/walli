import type { StorybookConfig } from "@storybook/vue3-vite";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const config: StorybookConfig = {
  stories: ["../stories-vue/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  staticDirs: ["../public"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/vue3-vite",
    options: {},
  },
  managerHead: (head) => `${head}
    <link rel="icon" type="image/png" href="/walli-robot-icon.png" />
    <style>
      a:has(> img[alt="Walli Chat"]) {
        display: inline-flex;
        width: auto;
        align-items: center;
        gap: 10px;
      }
      a:has(> img[alt="Walli Chat"]) > img {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        object-fit: cover;
      }
      a:has(> img[alt="Walli Chat"])::after {
        content: "Walli Chat";
        color: #1e293b;
        font: 700 19px/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: -0.35px;
        white-space: nowrap;
      }
    </style>
    <script>document.title = "Walli Chat";</script>`,
  async viteFinal(config) {
    const viteConfigUrl = pathToFileURL(resolve(process.cwd(), "vite.config.ts")).href;
    const { walliChatUnoCss } = await import(viteConfigUrl);
    config.plugins ??= [];
    config.plugins.push(walliChatUnoCss());
    return config;
  },
};

export default config;
