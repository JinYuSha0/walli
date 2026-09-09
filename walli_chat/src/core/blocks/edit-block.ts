import { measureLineStats, prepareWithSegments } from "@chenglou/pretext";
import { html } from "lit";
import { marked } from "marked";
import { imageBlockDefinition } from "./image-block";
import { getSpace } from "../styles/config";
import { ref } from "lit/directives/ref.js";
import type { WalliChatTokenizedBlockDefinition } from "../block-registry";
import type { WalliChatBlockAction, WalliChatEditConfig } from "../../types";
import { createInternalActionName, unescapeMarkdownText } from "../helper";
import { getCommonStyle } from "../styles";

type EditBlockData = {
  images: string[];
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

export function isEditBlockAction(
  action: WalliChatBlockAction,
): action is WalliChatEditBlockAction {
  return action.name === editBlockCancelActionName || action.name === editBlockSubmitActionName;
}

const font = "400 16px/24px sans-serif";
const lineHeight = 24;
const minimumInputHeight = 40;
const maximumInputHeight = 320;
const padding = getSpace(3);
const actionsGap = getSpace(3);
const actionsHeight = getSpace(9);
const actionButtonClass =
  "appearance-none box-border inline-flex h-[36px] min-h-[36px] max-h-[36px] flex-none cursor-pointer items-center justify-center rounded-[18px] px-3.5 py-0 font-sans text-sm font-medium leading-none outline-none transition-colors";

export function splitEditContent(markdown: string) {
  const images: EditBlockData["images"] = [];
  const text: string[] = [];
  for (const token of marked.lexer(markdown)) {
    const image =
      token.type === "paragraph"
        ? imageBlockDefinition.prepare(token.tokens, {
            role: "user",
            listDepth: 0,
            quoteDepth: 0,
          })
        : null;
    if (image) images.push(token.raw.trim());
    else text.push(token.raw);
  }
  return { images, value: unescapeMarkdownText(text.join("").trim()) };
}

const chromeHeight = padding * 2 + actionsGap + actionsHeight;

export function createEditBlockMarkdown(
  markdown: string,
  config: WalliChatEditConfig = {},
): string {
  const content = splitEditContent(markdown);
  const editor = `:::edit-block\n${JSON.stringify({
    cancelLabel: config.cancelLabel ?? "Cancel",
    focusPending: true,
    placeholder: config.placeholder ?? "Edit message",
    submitLabel: config.submitLabel ?? "Send",
    ...content,
  })}\n:::`;
  return [...content.images, editor].join("\n\n");
}

export const editBlockDefinition: WalliChatTokenizedBlockDefinition<EditBlockData> = {
  name: editBlockName,
  marginTop: getCommonStyle("blockGap"),
  measure(data, { availableWidth }) {
    const textWidth = Math.max(1, availableWidth - padding * 2);
    const prepared = prepareWithSegments(data.value || " ", font, { whiteSpace: "pre-wrap" });
    const inputHeight = Math.min(
      maximumInputHeight,
      Math.max(minimumInputHeight, measureLineStats(prepared, textWidth).lineCount * lineHeight),
    );
    return {
      height: inputHeight + chromeHeight,
      width: availableWidth,
    };
  },
  render({ ctx, data, height, messageId }) {
    const state = ctx.getBlockState(messageId, editBlockStateKey);
    const blockState = typeof state === "object" && state !== null ? state : {};
    if ("value" in blockState && typeof blockState.value === "string") {
      data.value = blockState.value;
    }
    const inputHeight = height - chromeHeight;
    const canSubmit = !ctx.isStreaming && (data.images.length > 0 || data.value.trim().length > 0);
    const submit = () => {
      if (!canSubmit) return;
      const value = data.value.trim();
      void ctx.action({
        data: {
          markdown: [...data.images, value].filter(Boolean).join("\n\n"),
        },
        messageId,
        name: editBlockSubmitActionName,
      } satisfies WalliChatEditBlockAction);
    };
    return html`
      <div
        class="box-border flex h-full w-full flex-col gap-3 rounded-2xl bg-muted p-3 text-foreground shadow-none"
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
              ...blockState,
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
            ?disabled=${!canSubmit}
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
            images: input.images ?? [],
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
