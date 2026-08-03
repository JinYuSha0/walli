import { computed, signal } from "@preact/signals-core";

export const BASE_TEXT_SIGNAL = signal<number>(16);

export const BASE_SPACE_SIGNAL = signal<number>(4);

const fontSizeMap = computed(() => ({
  "text-xs": 0.75 * BASE_TEXT_SIGNAL.value, // 12px
  "text-sm": 0.875 * BASE_TEXT_SIGNAL.value, // 14px
  "text-base": BASE_TEXT_SIGNAL.value, // 16px
  "text-lg": 1.125 * BASE_TEXT_SIGNAL.value, // 18px
  "text-xl": 1.25 * BASE_TEXT_SIGNAL.value, // 20px
  //   "text-2xl": 1.5 * BASE_TEXT_SIGNAL.value, // 24px
  //   "text-3xl": 1.875 * BASE_TEXT_SIGNAL.value, // 30px
  //   "text-4xl": 2.25 * BASE_TEXT_SIGNAL.value, // 36px
  //   "text-5xl": 3 * BASE_TEXT_SIGNAL.value, // 48px
  //   "text-6xl": 3.75 * BASE_TEXT_SIGNAL.value, // 60px
  //   "text-7xl": 4.5 * BASE_TEXT_SIGNAL.value, // 72px
  //   "text-8xl": 6 * BASE_TEXT_SIGNAL.value, // 96px
  //   "text-9xl": 8 * BASE_TEXT_SIGNAL.value, // 128px
}));

const lineHeightMap = computed(() => ({
  "text-xs": 1.125 * BASE_TEXT_SIGNAL.value, // 18px
  "text-sm": 1.25 * BASE_TEXT_SIGNAL.value, // 20px
  "text-base": 1.375 * BASE_TEXT_SIGNAL.value, // 22px
  "text-lg": 1.5625 * BASE_TEXT_SIGNAL.value, // 25px
  "text-xl": 1.75 * BASE_TEXT_SIGNAL.value, // 28px
  //   "text-2xl": 2 * BASE_TEXT_SIGNAL.value, // 32px
  //   "text-3xl": 2.375 * BASE_TEXT_SIGNAL.value, // 38px
  //   "text-4xl": 2.75 * BASE_TEXT_SIGNAL.value, // 44px
  //   "text-5xl": 3.5 * BASE_TEXT_SIGNAL.value, // 56px
  //   "text-6xl": 4.25 * BASE_TEXT_SIGNAL.value, // 68px
  //   "text-7xl": 5 * BASE_TEXT_SIGNAL.value, // 80px
  //   "text-8xl": 6.5 * BASE_TEXT_SIGNAL.value, // 104px
  //   "text-9xl": 8.5 * BASE_TEXT_SIGNAL.value, // 136px
}));

export function getFontSize(size: keyof typeof fontSizeMap.value) {
  return fontSizeMap.value[size];
}

export function getLineHeight(size: keyof typeof lineHeightMap.value) {
  return lineHeightMap.value[size];
}

export function getSpace(multiple: number) {
  return BASE_SPACE_SIGNAL.value * multiple;
}
