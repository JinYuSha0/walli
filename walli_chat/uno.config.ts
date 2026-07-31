import { defineConfig, presetWind3, type PresetWind3Theme } from "unocss";
import { walliUnoTheme } from "./uno.theme";

export default defineConfig<PresetWind3Theme>({
  presets: [presetWind3()],
  theme: walliUnoTheme,
});
