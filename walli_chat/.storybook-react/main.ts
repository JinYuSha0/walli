import type { StorybookConfig } from "@storybook/react-vite";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const config: StorybookConfig = {
  stories: ["../stories-react/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  staticDirs: ["../public"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // react-docgen follows the wrapper's re-exports into Lit sources and cannot
  // parse their standard decorator placement. Stories define controls explicitly.
  typescript: {
    reactDocgen: false,
  },
  managerHead: (head) => `${head}
    <link rel="icon" type="image/png" href="/walli-robot-icon.png" />
    <script>document.title = "Walli Chat · React";</script>`,
  async viteFinal(config) {
    const viteConfigUrl = pathToFileURL(resolve(process.cwd(), "vite.config.ts")).href;
    const { walliChatUnoCss } = await import(viteConfigUrl);
    config.plugins ??= [];
    config.plugins.push(walliChatUnoCss());
    return config;
  },
};

export default config;
