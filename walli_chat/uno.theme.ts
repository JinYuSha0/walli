import { presetWind3, type PresetWind3Theme } from "unocss";

const wind3Theme = presetWind3().theme as PresetWind3Theme;

function themeColor(name: string): string {
  return `var(--${name}, var(--walli-${name}))`;
}

export const walliUnoTheme: PresetWind3Theme = {
  animation: {
    counts: {
      "walli-breathe": "infinite",
      "walli-scroll-to-bottom-dot-pulse": "infinite",
      "walli-shimmer": "infinite",
    },
    durations: {
      "walli-breathe": "1.35s",
      "walli-scroll-to-bottom-dot-pulse": "1s",
      "walli-shimmer": "4s",
    },
    keyframes: {
      "walli-breathe": "{50%{opacity:1;transform:scale(1.45)}}",
      "walli-scroll-to-bottom-dot-pulse":
        "{0%,10%,100%{transform:translateY(0)}25%{transform:translateY(1.2px)}55%{transform:translateY(-2px)}70%{transform:translateY(0)}}",
      "walli-shimmer":
        "{from{background-position:200% center}to{background-position:-200% center}}",
    },
    properties: {
      "walli-shimmer": {
        "background-image":
          "linear-gradient(to right,var(--stream-shimmer-base,var(--walli-stream-shimmer-base)) var(--stream-shimmer-highlight-start,var(--walli-stream-shimmer-highlight-start)),var(--stream-shimmer-highlight,var(--walli-stream-shimmer-highlight)) 50%,var(--stream-shimmer-base,var(--walli-stream-shimmer-base)) var(--stream-shimmer-highlight-end,var(--walli-stream-shimmer-highlight-end)))",
        "background-size": "200% auto",
      },
    },
    timingFns: {
      "walli-breathe": "ease-in-out",
      "walli-scroll-to-bottom-dot-pulse": "ease-in-out",
      "walli-shimmer": "linear",
    },
  },
  colors: {
    ...wind3Theme.colors,
    background: themeColor("background"),
    "scroll-to-bottom": themeColor("scroll-to-bottom-background"),
    "scroll-to-bottom-hover": themeColor("scroll-to-bottom-background-hover"),
    foreground: themeColor("foreground"),
    card: themeColor("card"),
    "card-foreground": themeColor("card-foreground"),
    popover: themeColor("popover"),
    "popover-foreground": themeColor("popover-foreground"),
    primary: themeColor("primary"),
    "primary-foreground": themeColor("primary-foreground"),
    secondary: themeColor("secondary"),
    "secondary-foreground": themeColor("secondary-foreground"),
    muted: themeColor("muted"),
    "muted-foreground": themeColor("muted-foreground"),
    accent: themeColor("accent"),
    "accent-foreground": themeColor("accent-foreground"),
    border: themeColor("border"),
    ring: themeColor("ring"),
  },
};
