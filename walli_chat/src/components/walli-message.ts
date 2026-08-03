import { html, render, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { materializeMessageBlocks } from "../core";
import type { BlockLayout, ChatMessageInstance, MessageFrame } from "../core/type";
import { renderMessageBlockTemplate } from "../core/blocks";
import { getCommonStyle } from "../core/styles";

@customElement("walli-message")
export class WalliMessageElement extends HTMLElement {
  private currentBlocks: BlockLayout[] = [];
  private currentMessage: ChatMessageInstance | null = null;
  private currentKey = "";

  set message(message: ChatMessageInstance | null | undefined) {
    if (message === undefined || message === null) {
      return;
    }

    const key = this.computeKey(message.frame);
    const canReuseContents =
      this.currentMessage?.prepared === message.prepared && this.currentKey === key;

    this.currentMessage = message;
    this.currentKey = key;
    if (!canReuseContents) {
      this.currentBlocks = materializeMessageBlocks(message);
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
    return html`<div
      class=${
        message.frame.role === "assistant"
          ? "absolute left-0 flex w-full box-border justify-start"
          : "absolute left-0 flex w-full box-border justify-end"
      }
      style=${`top:${message.top}px; height:${message.frame.totalHeight}px; padding-inline:${getCommonStyle("messageSidePadding")}px;`}
    >
      <div
        class=${
          message.frame.role === "assistant"
            ? "message-bubble relative max-w-full flex-none rounded-none text-foreground"
            : "message-bubble relative max-w-full flex-none rounded-2xl bg-secondary text-secondary-foreground shadow-lg"
        }
        style=${`width:${message.frame.frameWidth}px;height:${message.frame.bubbleHeight}px;`}
      >
        ${blocks.map((block) => renderMessageBlockTemplate(block, message.frame.contentInsetX))}
      </div>
    </div>`;
  }

  private computeKey(frame: MessageFrame): string {
    return `${frame.frameWidth}:${frame.bubbleHeight}:${frame.totalHeight}:${frame.layoutContentWidth}:${frame.contentInsetX}`;
  }
}
