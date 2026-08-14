import { html, render, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { materializeMessageBlocks } from "../core";
import type { BlockLayout, ChatMessageInstance, MessageFrame } from "../core/type";
import { renderMessageBlockTemplate } from "../core/blocks";
import { getCommonStyle } from "../core/styles";
import clsx from "clsx";
import "../core/components";

@customElement("walli-message")
export class WalliMessageElement extends HTMLElement {
  private currentBlocks: BlockLayout[] = [];
  private currentMessage: ChatMessageInstance | null = null;
  private currentKey = "";

  set message(message: ChatMessageInstance | null | undefined) {
    if (message === undefined || message === null) {
      return;
    }

    const key = this.computeKey(message);
    const canReuseContents =
      this.currentMessage?.prepared === message.prepared && this.currentKey === key;

    this.currentMessage = message;
    this.currentKey = key;
    if (canReuseContents) return;

    this.currentBlocks = materializeMessageBlocks(message);
    this.renderMessage(message);
  }

  get message(): ChatMessageInstance | null {
    return this.currentMessage;
  }

  private renderMessage(message: ChatMessageInstance): void {
    render(this.renderLayout(message, this.currentBlocks), this);
  }

  private renderLayout(message: ChatMessageInstance, blocks: BlockLayout[]): TemplateResult {
    return html`<div
      class=${clsx({
        "group absolute left-0 flex w-full box-border justify-start": message.frame.role === "assistant",
        "group absolute left-0 flex w-full box-border justify-end": message.frame.role === "user",
      })}
      style=${`top:${message.top}px; height:${message.frame.totalHeight}px; padding-inline:${getCommonStyle("messageSidePadding")}px; padding-top:${message.frame.paddingTop}px;`}
    >
      <div class="flex max-w-full flex-none flex-col" style=${`width:${message.frame.frameWidth}px;`}>
        <div
          class=${clsx({
            "message-bubble relative max-w-full flex-none rounded-none text-foreground":
              message.frame.role === "assistant",
            "message-bubble relative max-w-full flex-none rounded-2xl text-secondary-foreground shadow-lg":
              message.frame.role === "user",
          })}
          style=${`width:${message.frame.frameWidth}px;height:${message.frame.bubbleHeight}px;${message.frame.role === "user" ? "background-color:var(--user-message-background);" : ""}`}
        >
          ${blocks.map((block) => renderMessageBlockTemplate(block, message.frame.contentInsetX))}
        </div>
        ${message.prepared.streaming
          ? null
          : message.frame.role === "assistant"
          ? html`<walli-assistant-message-actions
              .id=${message.prepared.id}
              .markdown=${message.prepared.markdown}
            ></walli-assistant-message-actions>`
          : html`<walli-user-message-actions
              .id=${message.prepared.id}
              .markdown=${message.prepared.markdown}
            ></walli-user-message-actions>`}
      </div>
    </div>`;
  }

  private computeKey(message: ChatMessageInstance): string {
    const frame: MessageFrame = message.frame;
    return `${message.top}:${frame.frameWidth}:${frame.bubbleHeight}:${frame.totalHeight}:${frame.layoutContentWidth}:${frame.contentInsetX}`;
  }
}
