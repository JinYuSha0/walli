import type { PresetWind3Theme } from "unocss";

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
          "linear-gradient(to right,var(--stream-shimmer-base,var(--muted-foreground)) var(--stream-shimmer-highlight-start,30%),var(--stream-shimmer-highlight,var(--foreground)) 50%,var(--stream-shimmer-base,var(--muted-foreground)) var(--stream-shimmer-highlight-end,70%))",
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
    background: "var(--background)",
    foreground: "var(--foreground)",
    card: "var(--card)",
    "card-foreground": "var(--card-foreground)",
    popover: "var(--popover)",
    "popover-foreground": "var(--popover-foreground)",
    primary: "var(--primary)",
    "primary-foreground": "var(--primary-foreground)",
    secondary: "var(--secondary)",
    "secondary-foreground": "var(--secondary-foreground)",
    muted: "var(--muted)",
    "muted-foreground": "var(--muted-foreground)",
    accent: "var(--accent)",
    "accent-foreground": "var(--accent-foreground)",
    destructive: "var(--destructive)",
    border: "var(--border)",
    input: "var(--input)",
    ring: "var(--ring)",
  },
};
