import { html, render, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { getBlockUsedWidth, materializeMessageBlocks } from "../core";
import type { BlockLayout, ChatMessageInstance, MessageFrame } from "../core/types";
import { renderMessageBlockTemplate, type WalliChatBlockContext } from "../core/block-registry";
import { getCommonStyle } from "../core/styles";
import clsx from "clsx";
import "./walli-message-actions";

@customElement("walli-message")
export class WalliMessageElement extends HTMLElement {
  private currentBlocks: BlockLayout[] = [];
  private currentMessage: ChatMessageInstance | null = null;
  private currentKey = "";
  private currentBlockContext: WalliChatBlockContext | undefined;
  private currentHasCustomBlock = false;

  update(message: ChatMessageInstance, context: WalliChatBlockContext): void {
    const streamingChanged = this.currentBlockContext?.isStreaming !== context.isStreaming;
    const localesChanged = this.currentBlockContext?.locales !== context.locales;
    const actionConfigChanged = this.currentBlockContext?.actionConfig !== context.actionConfig;
    this.currentBlockContext = context;
    const key = this.computeKey(message);
    const canReuseContents =
      this.currentMessage?.prepared === message.prepared && this.currentKey === key;

    this.currentMessage = message;
    this.currentKey = key;
    if (!canReuseContents) {
      const materialized = materializeMessageBlocks(message);
      this.currentBlocks = materialized.blocks;
      this.currentHasCustomBlock = materialized.hasCustomBlock;
    } else if (
      !localesChanged &&
      !actionConfigChanged &&
      (!streamingChanged || !this.currentHasCustomBlock)
    ) {
      return;
    }
    this.renderMessage(message);
  }

  get message(): ChatMessageInstance | null {
    return this.currentMessage;
  }

  private renderMessage(message: ChatMessageInstance): void {
    render(this.renderLayout(message, this.currentBlocks), this);
  }

  private renderLayout(message: ChatMessageInstance, blocks: BlockLayout[]): TemplateResult {
    const blockContext = this.createMessageBlockContext(message);
    if (message.prepared.role === "system") {
      return html`<div
        class="absolute left-0 w-full"
        style=${`top:${message.top}px;height:${message.frame.totalHeight}px;`}
        @click=${this.handleSystemMessageClick}
      >
        ${blocks.map((block) =>
          renderMessageBlockTemplate(
            block,
            Math.max(0, (message.frame.frameWidth - getBlockUsedWidth(block)) / 2),
            blockContext,
            block.kind === "custom" ? message.prepared.id : undefined,
            message.prepared.role,
          ),
        )}
      </div>`;
    }

    const assetsGroups =
      message.prepared.role === "user"
        ? blocks.filter((block) => block.kind === "assetsGroup")
        : [];
    const hasAssets = assetsGroups.length > 0;
    const textBlocks = hasAssets ? blocks.filter((block) => block.kind !== "assetsGroup") : [];
    const textBubbleStyle = getTextBubbleStyle(message.frame, textBlocks);
    const textContentInset = getTextContentInset(message.frame, textBlocks);
    const messageActionContext = this.createMessageActionContext(message);

    return html`<div
      class=${clsx({
        "group absolute left-0 flex w-full box-border justify-start":
          message.prepared.role !== "user",
        "group absolute left-0 flex w-full box-border justify-end":
          message.prepared.role === "user",
      })}
      style=${`top:${message.top}px; height:${message.frame.totalHeight}px; padding-inline:${getCommonStyle("messageSidePadding")}px; padding-top:${message.frame.paddingTop}px;`}
    >
      <div
        class="flex max-w-full flex-none flex-col"
        style=${`width:${message.frame.frameWidth}px;`}
      >
        <div
          class=${clsx({
            "message-bubble relative max-w-full flex-none rounded-none text-foreground":
              message.prepared.role !== "user",
            "message-bubble relative max-w-full flex-none rounded-2xl text-secondary-foreground shadow-lg":
              message.prepared.role === "user",
            "bg-transparent shadow-none": hasAssets,
          })}
          style=${`width:${message.frame.frameWidth}px;height:${message.frame.bubbleHeight}px;${message.prepared.role === "user" && !hasAssets ? "background-color:var(--user-message-background,var(--walli-user-message-background));" : ""}`}
        >
          ${
            textBubbleStyle
              ? html`<div class="absolute rounded-2xl shadow-lg" style=${textBubbleStyle}></div>`
              : null
          }
          ${blocks.map((block) =>
            renderMessageBlockTemplate(
              block,
              block.kind === "assetsGroup" ? 0 : textContentInset,
              blockContext,
              block.kind === "custom" ? message.prepared.id : undefined,
              message.prepared.role,
            ),
          )}
        </div>
        ${
          message.frame.actionHeight === 0
            ? null
            : html`<walli-message-actions
                style=${`display:block;margin-left:${message.frame.bodyInsetX}px;`}
                .context=${messageActionContext}
                .variant=${message.prepared.role}
              ></walli-message-actions>`
        }
      </div>
    </div>`;
  }

  private computeKey(message: ChatMessageInstance): string {
    const frame: MessageFrame = message.frame;
    return `${message.top}:${frame.frameWidth}:${frame.bubbleHeight}:${frame.totalHeight}:${frame.layoutContentWidth}:${frame.contentInsetX}:${message.prepared.markdown}`;
  }

  private createMessageBlockContext(
    message: ChatMessageInstance,
  ): WalliChatBlockContext | undefined {
    const context = this.currentBlockContext;
    if (context === undefined) return undefined;
    return {
      ...context,
      meta: message.prepared.meta,
      requestRender: () => {
        context.requestRender(message.prepared.id);
      },
      action: (action) =>
        context.action({
          ...action,
          markdown: message.prepared.markdown,
          messageType: message.prepared.role,
        }),
    };
  }

  private createMessageActionContext(message: ChatMessageInstance) {
    const context = this.currentBlockContext!;
    const messageId = message.prepared.id;
    return {
      actionConfig:
        message.prepared.role === "assistant"
          ? (context.actionConfig.assistant ?? {})
          : (context.actionConfig.user ?? {}),
      blockStates: context.blockStates,
      id: messageId,
      markdown: message.prepared.markdown,
      getBlockState: (key: string) => context.getBlockState(messageId, key),
      setBlockState: (key: string, value: unknown) => {
        context.setBlockState(messageId, key, value);
        context.requestRender(messageId);
      },
    };
  }

  private readonly handleSystemMessageClick = (event: MouseEvent): void => {
    const anchor = event
      .composedPath()
      .find((target): target is HTMLAnchorElement => target instanceof HTMLAnchorElement);
    if (
      anchor === undefined ||
      this.currentMessage === null ||
      this.currentBlockContext === undefined
    )
      return;

    event.preventDefault();
    const action = {
      data: {
        href: anchor.getAttribute("href") ?? "",
        text: anchor.textContent ?? "",
      },
      markdown: this.currentMessage.prepared.markdown,
      messageId: this.currentMessage.prepared.id,
      messageType: this.currentMessage.prepared.role,
      name: "system-message-link",
    };
    void this.currentBlockContext.action(action);
  };
}

function getTextBubbleStyle(
  frame: MessageFrame,
  textBlocks: readonly BlockLayout[],
): string | null {
  if (textBlocks.length === 0) return null;

  const textWidth = Math.max(...textBlocks.map(getBlockUsedWidth));
  const bubbleWidth = Math.min(frame.frameWidth, frame.contentInsetX * 2 + textWidth);
  const left = frame.frameWidth - bubbleWidth;
  const top = Math.min(...textBlocks.map((block) => block.top));
  const bottom = Math.max(...textBlocks.map((block) => block.top + block.height));
  const paddingY = getCommonStyle("bubblePaddingY");
  return `background-color:var(--user-message-background,var(--walli-user-message-background));left:${left}px;top:${top - paddingY}px;width:${bubbleWidth}px;height:${bottom - top + paddingY * 2}px;`;
}

function getTextContentInset(frame: MessageFrame, textBlocks: readonly BlockLayout[]): number {
  if (textBlocks.length === 0) return frame.contentInsetX;
  const textWidth = Math.max(...textBlocks.map(getBlockUsedWidth));
  const bubbleWidth = Math.min(frame.frameWidth, frame.contentInsetX * 2 + textWidth);
  return frame.contentInsetX + frame.frameWidth - bubbleWidth;
}
