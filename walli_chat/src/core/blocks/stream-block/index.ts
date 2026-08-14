import { html } from "lit";
import { computed } from "@preact/signals-core";
import {
  measureLineStats,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import { getFont } from "../../styles";
import { getLineHeight, getSpace } from "../../styles/config";
import { registerCustomBlock, type WalliChatCustomBlockDefinition } from "../custom-block";
import streamBlockStyles from "./stream-block.css?inline";

type StartBlockData = Record<string, never>;

type ToolCallBlockData = {
  label?: string;
  toolCallId: string;
  toolName: string;
};

const StreamBlockStyle = computed(() => {
  const startDotSize = getSpace(2);
  const startPaddingY = getSpace(3);

  return {
    startDotSize,
    startPaddingX: getSpace(1),
    startPaddingY,
    startBlockHeight: startDotSize + startPaddingY * 2,
    toolLabelFont: getFont("body", null, "text-sm", "font-sans", 500),
    toolLineHeight: getLineHeight("text-sm"),
    toolPaddingY: getSpace(2.5),
  };
});

export function getStreamBlockStyle<Key extends keyof (typeof StreamBlockStyle)["value"]>(
  key: Key,
): (typeof StreamBlockStyle)["value"][Key] {
  return StreamBlockStyle.value[key];
}

const preparedToolLabelCache = new WeakMap<ToolCallBlockData, PreparedTextWithSegments>();

function getToolLabel(data: ToolCallBlockData): string {
  return data.label ?? `Calling ${data.toolName}`;
}

function getPreparedToolLabel(data: ToolCallBlockData): PreparedTextWithSegments {
  const cached = preparedToolLabelCache.get(data);
  if (cached !== undefined) return cached;
  const prepared = prepareWithSegments(getToolLabel(data), getStreamBlockStyle("toolLabelFont"));
  preparedToolLabelCache.set(data, prepared);
  return prepared;
}

const startBlockDefinition = {
  name: "start-block",
  styles: streamBlockStyles,
  tokenizer: {
    tokenize(source) {
      const match = /^:::start-block[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;
      return { data: {}, raw: match[0] };
    },
  },
  measure(_data, { availableWidth }) {
    return { height: getStreamBlockStyle("startBlockHeight"), width: availableWidth };
  },
  render() {
    return html`<div
      class="start-row"
      aria-label="starting now"
      style=${`padding:${getStreamBlockStyle("startPaddingY")}px ${getStreamBlockStyle("startPaddingX")}px;`}
    >
      <span
        class="breath"
        style=${`height:${getStreamBlockStyle("startDotSize")}px;width:${getStreamBlockStyle("startDotSize")}px;`}
      ></span>
    </div>`;
  },
} satisfies WalliChatCustomBlockDefinition<StartBlockData>;

const toolCallBlockDefinition = {
  name: "toolcall-block",
  styles: streamBlockStyles,
  tokenizer: {
    tokenize(source) {
      const match = /^:::toolcall-block[ \t]*\n([^\n]+)\n:::[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;
      try {
        const value = JSON.parse(match[1]!) as ToolCallBlockData;
        if (
          typeof value.toolCallId !== "string" ||
          typeof value.toolName !== "string" ||
          (value.label !== undefined && typeof value.label !== "string")
        ) {
          return undefined;
        }
        return { data: value, raw: match[0] };
      } catch {
        return undefined;
      }
    },
  },
  measure(data, { availableWidth }) {
    const { lineCount } = measureLineStats(getPreparedToolLabel(data), Math.max(1, availableWidth));
    return {
      height:
        getStreamBlockStyle("toolPaddingY") * 2 + lineCount * getStreamBlockStyle("toolLineHeight"),
      width: availableWidth,
    };
  },
  render({ data }) {
    const label = getToolLabel(data);
    return html`<div
      class="row tool-row"
      aria-label=${label}
      style=${`padding-block:${getStreamBlockStyle("toolPaddingY")}px;`}
    >
      <span
        class="shimmer"
        style=${`font:${getStreamBlockStyle("toolLabelFont")};line-height:${getStreamBlockStyle("toolLineHeight")}px;`}
        >${label}</span
      >
    </div>`;
  },
} satisfies WalliChatCustomBlockDefinition<ToolCallBlockData>;

let registered = false;

export function registerStreamBlocks(): void {
  if (registered) return;
  registerCustomBlock(startBlockDefinition);
  registerCustomBlock(toolCallBlockDefinition);
  registered = true;
}
