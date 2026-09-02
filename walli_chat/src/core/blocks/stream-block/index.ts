import { html } from "lit";
import { computed } from "@preact/signals-core";
import { ChevronDown, CircleX, createElement } from "lucide";
import {
  layoutWithLines,
  measureLineStats,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import { getFont } from "../../styles";
import { getLineHeight, getSpace } from "../../styles/config";
import type { WalliChatTokenizedBlockDefinition } from "../../block-registry";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";

type StartBlockData = Record<string, never>;

type ReasoningBlockData = {
  collapsed?: boolean;
  complete?: boolean;
  text: string;
  thinkingLabel?: string;
  thoughtLabel?: string;
};

type PreparedReasoningBlockData = ReasoningBlockData & {
  prepared: PreparedTextWithSegments;
};

type ToolCallBlockData = {
  label?: string;
  toolCallId: string;
  toolName: string;
};

type ErrorBlockData = {
  text: string;
};

type PreparedErrorBlockData = ErrorBlockData & {
  prepared: PreparedTextWithSegments;
};

const StreamBlockStyle = computed(() => {
  const startDotSize = getSpace(2);
  const startPaddingY = getSpace(3);

  return {
    startDotSize,
    startPaddingX: getSpace(1),
    startPaddingY,
    startBlockHeight: startDotSize + startPaddingY * 2,
    reasoningFont: getFont("body", null, "text-sm", "font-sans", 400),
    reasoningContentInset: getSpace(3.5),
    reasoningGap: getSpace(2),
    reasoningHeaderLineHeight: getLineHeight("text-sm"),
    reasoningLineHeight: getLineHeight("text-sm"),
    reasoningPaddingY: getSpace(2),
    errorFont: getFont("body", null, "text-sm", "font-sans", 500),
    errorHorizontalPadding: getSpace(3.5),
    errorVerticalPadding: getSpace(3),
    errorIconSize: getSpace(6),
    errorIconTextGap: getSpace(2.5),
    errorLineHeight: getLineHeight("text-sm"),
    errorMinimumHeight: getSpace(12),
    toolLabelFont: getFont("body", null, "text-sm", "font-sans", 500),
    toolLineHeight: getLineHeight("text-sm"),
    toolPaddingY: getSpace(2.5),
  };
});

function getStreamBlockStyle<Key extends keyof (typeof StreamBlockStyle)["value"]>(
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

export const startBlockDefinition = {
  name: "start-block",
  styles: walliChatUnoCss,
  tokenizer: {
    tokenize(source) {
      const match = /^:::start-block[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;
      return { data: {} as StartBlockData, raw: match[0] };
    },
  },
  measure(_data, { availableWidth }) {
    return { height: getStreamBlockStyle("startBlockHeight"), width: availableWidth };
  },
  render() {
    return html`<div
      class="absolute inset-0 box-border flex items-center overflow-visible text-foreground"
      aria-label="Starting now"
      style=${`padding:${getStreamBlockStyle("startPaddingY")}px ${getStreamBlockStyle("startPaddingX")}px;`}
    >
      <span
        class="animate-walli-breathe flex-none origin-center rounded-full bg-current opacity-45"
        style=${`height:${getStreamBlockStyle("startDotSize")}px;width:${getStreamBlockStyle("startDotSize")}px;`}
      ></span>
    </div>`;
  },
} satisfies WalliChatTokenizedBlockDefinition<StartBlockData>;

export const reasoningBlockDefinition = {
  name: "reasoning-block",
  marginBottom: getSpace(2),
  styles: walliChatUnoCss,
  tokenizer: {
    tokenize(source) {
      const match = /^:::reasoning-block[ \t]*\n([^\n]+)\n:::[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;
      try {
        const value = JSON.parse(match[1]!) as ReasoningBlockData;
        if (
          typeof value.text !== "string" ||
          (value.thinkingLabel !== undefined && typeof value.thinkingLabel !== "string") ||
          (value.thoughtLabel !== undefined && typeof value.thoughtLabel !== "string")
        ) {
          return undefined;
        }
        return { data: value, raw: match[0] };
      } catch {
        return undefined;
      }
    },
  },
  prepare(data) {
    return {
      ...data,
      prepared: prepareWithSegments(data.text, getStreamBlockStyle("reasoningFont")),
    };
  },
  materialize(data) {
    return data;
  },
  measure(data, { availableWidth }) {
    if (data.collapsed === true) {
      return {
        height:
          getStreamBlockStyle("reasoningPaddingY") * 2 +
          getStreamBlockStyle("reasoningHeaderLineHeight"),
        width: availableWidth,
      };
    }
    const contentWidth = Math.max(1, availableWidth - getStreamBlockStyle("reasoningContentInset"));
    const { lineCount } = measureLineStats(data.prepared, contentWidth);
    return {
      height:
        getStreamBlockStyle("reasoningPaddingY") * 2 +
        getStreamBlockStyle("reasoningHeaderLineHeight") +
        getStreamBlockStyle("reasoningGap") +
        Math.max(1, lineCount) * getStreamBlockStyle("reasoningLineHeight"),
      width: availableWidth,
    };
  },
  render({ ctx, data, messageId, width }) {
    const paddingY = getStreamBlockStyle("reasoningPaddingY");
    const headerLineHeight = getStreamBlockStyle("reasoningHeaderLineHeight");
    const lineHeight = getStreamBlockStyle("reasoningLineHeight");
    const textTop = paddingY + headerLineHeight + getStreamBlockStyle("reasoningGap");
    const contentInset = getStreamBlockStyle("reasoningContentInset");
    const textLayout = layoutWithLines(
      data.prepared,
      Math.max(1, width - contentInset),
      lineHeight,
    );
    const statusLabel =
      data.complete === true
        ? (data.thoughtLabel ?? "Thought")
        : (data.thinkingLabel ?? "Thinking");
    const collapseIcon = createElement(ChevronDown, {
      "aria-hidden": "true",
      height: 14,
      width: 14,
      class: "flex-none opacity-60 transition-transform duration-150",
      style: `transform:rotate(${data.collapsed === true ? "-90deg" : "0deg"})`,
    });

    return html`<div
      class="absolute inset-0 box-border overflow-hidden font-sans text-muted-foreground"
      aria-label=${statusLabel}
      role="status"
    >
      <div
        class="absolute flex items-center font-medium"
        style=${`left:0;top:${paddingY}px;height:${headerLineHeight}px;line-height:${headerLineHeight}px;`}
      >
        <button
          type="button"
          class="flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-inherit text-inherit transition-colors hover:text-foreground"
          aria-expanded=${data.collapsed !== true}
          @click=${() => {
            data.collapsed = data.collapsed !== true;
            ctx.setBlockState(messageId, "reasoningCollapsed", data.collapsed);
            ctx.requestRender();
          }}
        >
          <span
            class=${
              data.complete === true
                ? ""
                : "animate-walli-shimmer bg-clip-text text-transparent [-webkit-background-clip:text]"
            }
            >${statusLabel}</span
          >
          ${collapseIcon}
        </button>
      </div>
      ${
        data.collapsed === true
          ? null
          : html`
              <div
                class="absolute bg-border"
                style=${`left:0;top:${textTop}px;bottom:${paddingY}px;width:1px;`}
                aria-hidden="true"
              ></div>
              <div class="whitespace-pre-wrap">
                <span class="sr-only">${data.text}</span>
                ${textLayout.lines.map(
                  (line, index) =>
                    html`<span
                      class="absolute whitespace-pre"
                      style=${`left:${contentInset}px;right:0;top:${textTop + index * lineHeight}px;height:${lineHeight}px;font:${getStreamBlockStyle("reasoningFont")};line-height:${lineHeight}px;`}
                      aria-hidden="true"
                      >${line.text}</span
                    >`,
                )}
              </div>
            `
      }
    </div>`;
  },
} satisfies WalliChatTokenizedBlockDefinition<ReasoningBlockData, PreparedReasoningBlockData>;

export const errorBlockDefinition = {
  name: "error-block",
  marginTop: getSpace(3),
  styles: walliChatUnoCss,
  tokenizer: {
    tokenize(source) {
      const match = /^:::error-block[ \t]*\n([^\n]+)\n:::[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;
      try {
        const value = JSON.parse(match[1]!) as ErrorBlockData;
        if (typeof value.text !== "string" || value.text.trim().length === 0) return undefined;
        return { data: value, raw: match[0] };
      } catch {
        return undefined;
      }
    },
  },
  prepare(data) {
    return {
      ...data,
      prepared: prepareWithSegments(data.text, getStreamBlockStyle("errorFont")),
    };
  },
  materialize(data) {
    return data;
  },
  measure(data, { availableWidth }) {
    const contentWidth = Math.max(
      1,
      availableWidth -
        getStreamBlockStyle("errorHorizontalPadding") * 2 -
        getStreamBlockStyle("errorIconSize") -
        getStreamBlockStyle("errorIconTextGap"),
    );
    const lineCount = measureLineStats(data.prepared, contentWidth).lineCount;
    return {
      height: Math.max(
        getStreamBlockStyle("errorMinimumHeight"),
        getStreamBlockStyle("errorVerticalPadding") * 2 +
          lineCount * getStreamBlockStyle("errorLineHeight"),
      ),
      width: availableWidth,
    };
  },
  render({ data, height, width }) {
    const lineHeight = getStreamBlockStyle("errorLineHeight");
    const iconSize = getStreamBlockStyle("errorIconSize");
    const horizontalPadding = getStreamBlockStyle("errorHorizontalPadding");
    const contentWidth = Math.max(
      1,
      width - horizontalPadding * 2 - iconSize - getStreamBlockStyle("errorIconTextGap"),
    );
    const textLayout = layoutWithLines(data.prepared, contentWidth, lineHeight);
    const textLeft = horizontalPadding + iconSize + getStreamBlockStyle("errorIconTextGap");
    const textTop = (height - textLayout.lines.length * lineHeight) / 2;
    const icon = createElement(CircleX, {
      "aria-hidden": "true",
      height: 18,
      strokeWidth: 2,
      width: 18,
    });

    return html`<div
      class="relative box-border h-full w-full overflow-hidden rounded-xl border border-solid font-sans text-sm font-medium leading-5 [background:var(--error-background,var(--walli-error-background))] [border-color:var(--error,var(--walli-error))] [color:var(--error,var(--walli-error))]"
      role="alert"
      aria-label=${data.text}
    >
      <span
        class="absolute flex items-center justify-center"
        style=${`left:${horizontalPadding}px;top:${(height - iconSize) / 2}px;width:${iconSize}px;height:${iconSize}px`}
        aria-hidden="true"
        >${icon}</span
      >
      ${textLayout.lines.map(
        (line, index) =>
          html`<span
            class="absolute whitespace-pre"
            style=${`left:${textLeft}px;top:${textTop + index * lineHeight}px;height:${lineHeight}px`}
            aria-hidden="true"
            >${line.text}</span
          >`,
      )}
    </div>`;
  },
} satisfies WalliChatTokenizedBlockDefinition<ErrorBlockData, PreparedErrorBlockData>;

export const toolCallBlockDefinition = {
  name: "toolcall-block",
  styles: walliChatUnoCss,
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
      class="box-border flex h-full items-start gap-2.5 text-foreground"
      aria-label=${label}
      style=${`padding-block:${getStreamBlockStyle("toolPaddingY")}px;`}
    >
      <span
        class="animate-walli-shimmer min-w-0 bg-clip-text text-transparent [-webkit-background-clip:text]"
        style=${`font:${getStreamBlockStyle("toolLabelFont")};line-height:${getStreamBlockStyle("toolLineHeight")}px;`}
        >${label}</span
      >
    </div>`;
  },
} satisfies WalliChatTokenizedBlockDefinition<ToolCallBlockData>;
