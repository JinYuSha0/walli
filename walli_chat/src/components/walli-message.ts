import { customElement } from "lit/decorators.js";
import {
  materializeMessageBlocks,
  MESSAGE_SIDE_PADDING,
  type ChatMessageInstance,
  type MessageFrame,
} from "../markdown-chat.model";
import { createMessageBlockElement } from "./blocks";

const MESSAGE_ROW_CLASS = "absolute left-0 flex w-full box-border";
const MESSAGE_BUBBLE_CLASS = "relative max-w-full flex-none";
const USER_BUBBLE_CLASS = "rounded-2xl bg-secondary text-secondary-foreground shadow-lg";
const ASSISTANT_BUBBLE_CLASS = "rounded-none text-foreground";

@customElement("walli-message")
export class WalliMessageElement extends HTMLElement {
  private bubble: HTMLDivElement | null = null;
  private currentMessage: ChatMessageInstance | null = null;
  private currentLayoutSignature = "";

  set message(message: ChatMessageInstance | null | undefined) {
    if (message === undefined || message === null) {
      return;
    }

    const layoutSignature = this.layoutSignature(message.frame);
    const canReuseContents =
      this.currentMessage?.prepared === message.prepared &&
      this.currentLayoutSignature === layoutSignature;

    this.currentMessage = message;
    this.currentLayoutSignature = layoutSignature;
    if (!canReuseContents) {
      this.renderMessage(message);
    }
    this.project(message.frame, message.top);
  }

  get message(): ChatMessageInstance | null {
    return this.currentMessage;
  }

  private renderMessage(message: ChatMessageInstance): void {
    const bubble = this.getBubble();

    this.className = `${MESSAGE_ROW_CLASS} ${
      message.frame.role === "assistant" ? "justify-start" : "justify-end"
    }`;
    this.style.paddingInline = `${MESSAGE_SIDE_PADDING}px`;
    bubble.className = `${MESSAGE_BUBBLE_CLASS} ${
      message.frame.role === "assistant" ? ASSISTANT_BUBBLE_CLASS : USER_BUBBLE_CLASS
    }`;

    const blocks = materializeMessageBlocks(message);
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < blocks.length; index++) {
      fragment.append(createMessageBlockElement(blocks[index]!, message.frame.contentInsetX));
    }
    bubble.replaceChildren(fragment);
  }

  private project(frame: MessageFrame, top: number): void {
    const bubble = this.getBubble();

    this.style.top = `${top}px`;
    this.style.height = `${frame.totalHeight}px`;
    bubble.style.width = `${frame.frameWidth}px`;
    bubble.style.height = `${frame.bubbleHeight}px`;
  }

  private layoutSignature(frame: MessageFrame): string {
    return `${frame.frameWidth}:${frame.bubbleHeight}:${frame.totalHeight}:${frame.layoutContentWidth}:${frame.contentInsetX}`;
  }

  private getBubble(): HTMLDivElement {
    if (this.bubble === null) {
      this.bubble = document.createElement("div");
    }
    if (this.bubble.parentNode !== this) {
      this.append(this.bubble);
    }
    return this.bubble;
  }
}
