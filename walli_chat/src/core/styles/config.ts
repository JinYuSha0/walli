import { computed, signal } from "@preact/signals-core";

export const BASE_TEXT_SIGNAL = signal<number>(16);

export const BASE_SPACE_SIGNAL = signal<number>(4);

const fontSizeMap = computed(() => ({
  "text-xs": 0.75 * BASE_TEXT_SIGNAL.value, // 12px
  "text-sm": 0.875 * BASE_TEXT_SIGNAL.value, // 14px
  "text-base": BASE_TEXT_SIGNAL.value, // 16px
  "text-lg": 1.125 * BASE_TEXT_SIGNAL.value, // 18px
  "text-xl": 1.25 * BASE_TEXT_SIGNAL.value, // 20px
}));

const lineHeightMap = computed(() => ({
  "text-xs": BASE_TEXT_SIGNAL.value, // 16px
  "text-sm": 1.25 * BASE_TEXT_SIGNAL.value, // 20px
  "text-base": 1.625 * BASE_TEXT_SIGNAL.value, // 26px
  "text-lg": 1.75 * BASE_TEXT_SIGNAL.value, // 28px
  "text-xl": 1.875 * BASE_TEXT_SIGNAL.value, // 30px
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
