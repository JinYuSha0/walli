import { measureLineStats, prepareWithSegments } from "@chenglou/pretext";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";
import type { WalliChatTokenizedBlockDefinition } from "../block-registry";
import type { WalliChatBlockAction, WalliChatEditConfig } from "../../types";
import { createInternalActionName } from "../helper";
import { getCommonStyle } from "../styles";

type EditBlockData = {
  cancelLabel: string;
  focusPending?: boolean;
  placeholder: string;
  submitLabel: string;
  value: string;
};

export const editBlockName = "edit-block";
export const editBlockStateKey = "edit-block";
export const editBlockCancelActionName = createInternalActionName("edit-block-cancel");
export const editBlockSubmitActionName = createInternalActionName("edit-block-submit");

export type WalliChatEditBlockAction =
  | WalliChatBlockAction<typeof editBlockCancelActionName, undefined>
  | WalliChatBlockAction<typeof editBlockSubmitActionName, { markdown: string }>;

const font = "400 16px/24px sans-serif";
const lineHeight = 24;
const minimumInputHeight = 40;
const maximumInputHeight = 320;
const paddingX = 12;
const paddingTop = 12;
const actionsGap = 12;
const actionsHeight = 36;
const paddingBottom = 12;
const actionButtonClass =
  "appearance-none box-border inline-flex h-[36px] min-h-[36px] max-h-[36px] flex-none cursor-pointer items-center justify-center rounded-[18px] px-3.5 py-0 font-sans text-sm font-medium leading-none outline-none transition-colors";

export function createEditBlockMarkdown(value: string, config: WalliChatEditConfig = {}): string {
  return `:::edit-block\n${JSON.stringify({
    cancelLabel: config.cancelLabel ?? "Cancel",
    focusPending: true,
    placeholder: config.placeholder ?? "Edit message",
    submitLabel: config.submitLabel ?? "Send",
    value,
  })}\n:::`;
}

export const editBlockDefinition: WalliChatTokenizedBlockDefinition<EditBlockData> = {
  name: editBlockName,
  marginTop: -getCommonStyle("bubblePaddingY"),
  measure(data, { availableWidth }) {
    const textWidth = Math.max(1, availableWidth - paddingX * 2);
    const prepared = prepareWithSegments(data.value || " ", font, { whiteSpace: "pre-wrap" });
    const inputHeight = Math.min(
      maximumInputHeight,
      Math.max(minimumInputHeight, measureLineStats(prepared, textWidth).lineCount * lineHeight),
    );
    return {
      height: paddingTop + inputHeight + actionsGap + actionsHeight + paddingBottom,
      width: availableWidth,
    };
  },
  render({ ctx, data, height, messageId }) {
    const blockState = ctx.getBlockState(messageId, editBlockStateKey);
    if (
      typeof blockState === "object" &&
      blockState !== null &&
      "value" in blockState &&
      typeof blockState.value === "string"
    ) {
      data.value = blockState.value;
    }
    const inputHeight = height - paddingTop - actionsGap - actionsHeight - paddingBottom;
    const submit = () => {
      if (ctx.isStreaming) return;
      const value = data.value.trim();
      if (!value) return;
      void ctx.action({
        data: { markdown: value },
        messageId,
        name: editBlockSubmitActionName,
      } satisfies WalliChatEditBlockAction);
    };
    return html`
      <div
        class="box-border flex h-full w-full flex-col rounded-2xl bg-muted text-foreground shadow-none"
        style=${`height:${height}px;padding:${paddingTop}px ${paddingX}px ${paddingBottom}px;gap:${actionsGap}px`}
      >
        <textarea
          ${ref((element) => {
            if (!(element instanceof HTMLTextAreaElement) || !data.focusPending) return;
            data.focusPending = false;
            requestAnimationFrame(() => {
              element.focus({ preventScroll: true });
              element.setSelectionRange(element.value.length, element.value.length);
            });
          })}
          aria-label=${data.placeholder}
          class="box-border w-full min-h-0 flex-none resize-none overflow-y-auto border-0 bg-transparent p-0 text-inherit outline-none [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
          placeholder=${data.placeholder}
          style=${`height:${inputHeight}px;font:${font};-webkit-text-size-adjust:100%;text-size-adjust:100%`}
          .value=${data.value}
          @input=${(event: Event) => {
            data.value = (event.currentTarget as HTMLTextAreaElement).value;
            ctx.setBlockState(messageId, editBlockStateKey, {
              ...(typeof blockState === "object" && blockState !== null ? blockState : {}),
              value: data.value,
            });
            ctx.requestRender(messageId);
          }}
        ></textarea>
        <div class="flex flex-none justify-end gap-2" style=${`height:${actionsHeight}px`}>
          <button
            class=${`${actionButtonClass} border border-solid border-border bg-background text-foreground hover:bg-muted`}
            type="button"
            @click=${() =>
              ctx.action({
                data: undefined,
                messageId,
                name: editBlockCancelActionName,
              } satisfies WalliChatEditBlockAction)}
          >
            ${data.cancelLabel}
          </button>
          <button
            class=${`${actionButtonClass} border-0 bg-foreground text-background hover:bg-foreground/85 disabled:cursor-default disabled:opacity-45`}
            type="button"
            ?disabled=${ctx.isStreaming || data.value.trim().length === 0}
            @click=${submit}
          >
            ${data.submitLabel}
          </button>
        </div>
      </div>
    `;
  },
  tokenizer: {
    tokenize(source) {
      const match = /^:::edit-block[ \t]*\n([^\n]*)\n:::[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;
      try {
        const input = JSON.parse(match[1]!) as Partial<EditBlockData>;
        if (typeof input.value !== "string") return undefined;
        return {
          data: {
            cancelLabel: typeof input.cancelLabel === "string" ? input.cancelLabel : "Cancel",
            focusPending: input.focusPending === true,
            placeholder: typeof input.placeholder === "string" ? input.placeholder : "Edit message",
            submitLabel: typeof input.submitLabel === "string" ? input.submitLabel : "Send",
            value: input.value,
          },
          raw: match[0],
        };
      } catch {
        return undefined;
      }
    },
  },
};
