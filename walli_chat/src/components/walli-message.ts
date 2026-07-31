import { customElement } from "lit/decorators.js";
import {
  CODE_BLOCK_PADDING_X,
  CODE_BLOCK_PADDING_Y,
  CODE_LINE_HEIGHT,
  materializeMessageBlocks,
  MESSAGE_SIDE_PADDING,
  type BlockLayout,
  type ChatMessageInstance,
  type InlineFragmentLayout,
  type MessageFrame,
} from "../markdown-chat.model";

const MESSAGE_ROW_CLASS = "absolute left-0 flex w-full box-border";
const MESSAGE_BUBBLE_CLASS = "relative max-w-full flex-none";
const USER_BUBBLE_CLASS = "rounded-2xl bg-secondary text-secondary-foreground shadow-lg";
const ASSISTANT_BUBBLE_CLASS = "rounded-none text-foreground";
const BLOCK_CLASS = "absolute left-0 w-full box-border";
const LINE_ROW_CLASS = "absolute flex w-max items-center gap-0";
const QUOTE_RAIL_CLASS =
  "absolute top-0 bottom-0 w-[3px] rounded-full bg-muted-foreground opacity-20";
const CODE_BOX_CLASS =
  "absolute top-0 rounded-[10px] bg-secondary ring-1 ring-border shadow-inner";
const CODE_LINE_CLASS =
  "absolute whitespace-pre font-mono text-[12px] font-medium leading-[18px] text-secondary-foreground";
const RULE_LINE_CLASS = "absolute h-px bg-border";

@customElement("walli-message")
export class WalliMessageElement extends HTMLElement {
  private bubble: HTMLDivElement | null = null;
  private currentMessage: ChatMessageInstance | null = null;

  set message(message: ChatMessageInstance | null | undefined) {
    if (message === undefined || message === null || message === this.currentMessage) {
      return;
    }

    this.currentMessage = message;
    this.renderMessage(message);
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
      fragment.append(this.renderBlock(blocks[index]!, message.frame.contentInsetX));
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

  private getBubble(): HTMLDivElement {
    if (this.bubble === null) {
      this.bubble = document.createElement("div");
    }
    if (this.bubble.parentNode !== this) {
      this.append(this.bubble);
    }
    return this.bubble;
  }

  private renderBlock(block: BlockLayout, contentInsetX: number): HTMLElement {
    switch (block.kind) {
      case "inline":
        return this.renderInlineBlock(block, contentInsetX);
      case "code":
        return this.renderCodeBlock(block, contentInsetX);
      case "rule":
        return this.renderRuleBlock(block, contentInsetX);
    }
  }

  private renderInlineBlock(
    block: Extract<BlockLayout, { kind: "inline" }>,
    contentInsetX: number,
  ): HTMLElement {
    const wrapper = this.createBlockShell(block, BLOCK_CLASS, contentInsetX);

    for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
      const line = block.lines[lineIndex]!;
      const row = document.createElement("div");
      row.className = LINE_ROW_CLASS;
      row.style.height = `${block.lineHeight}px`;
      row.style.left = `${contentInsetX + block.contentLeft}px`;
      row.style.top = `${lineIndex * block.lineHeight}px`;

      for (let fragmentIndex = 0; fragmentIndex < line.fragments.length; fragmentIndex++) {
        row.append(this.renderInlineFragment(line.fragments[fragmentIndex]!));
      }
      wrapper.append(row);
    }

    return wrapper;
  }

  private renderCodeBlock(
    block: Extract<BlockLayout, { kind: "code" }>,
    contentInsetX: number,
  ): HTMLElement {
    const wrapper = this.createBlockShell(block, BLOCK_CLASS, contentInsetX);

    const codeBox = document.createElement("div");
    codeBox.className = CODE_BOX_CLASS;
    codeBox.style.left = `${contentInsetX + block.contentLeft}px`;
    codeBox.style.width = `${block.width}px`;
    codeBox.style.height = `${block.height}px`;

    for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
      const line = block.lines[lineIndex]!;
      const row = document.createElement("div");
      row.className = CODE_LINE_CLASS;
      row.style.left = `${CODE_BLOCK_PADDING_X}px`;
      row.style.top = `${CODE_BLOCK_PADDING_Y + lineIndex * CODE_LINE_HEIGHT}px`;
      row.textContent = line.text;
      codeBox.append(row);
    }

    wrapper.append(codeBox);
    return wrapper;
  }

  private renderRuleBlock(
    block: Extract<BlockLayout, { kind: "rule" }>,
    contentInsetX: number,
  ): HTMLElement {
    const wrapper = this.createBlockShell(block, BLOCK_CLASS, contentInsetX);
    const rule = document.createElement("div");
    rule.className = RULE_LINE_CLASS;
    rule.style.left = `${contentInsetX + block.contentLeft}px`;
    rule.style.top = `${Math.floor(block.height / 2)}px`;
    rule.style.width = `${block.width}px`;
    wrapper.append(rule);
    return wrapper;
  }

  private createBlockShell(
    block: BlockLayout,
    className: string,
    contentInsetX: number,
  ): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.className = className;
    wrapper.style.top = `${block.top}px`;
    wrapper.style.height = `${block.height}px`;

    this.appendRails(wrapper, block, contentInsetX);
    this.appendMarker(wrapper, block, contentInsetX);
    return wrapper;
  }

  private appendRails(wrapper: HTMLDivElement, block: BlockLayout, contentInsetX: number): void {
    for (let index = 0; index < block.quoteRailLefts.length; index++) {
      const rail = document.createElement("div");
      rail.className = QUOTE_RAIL_CLASS;
      rail.style.left = `${contentInsetX + block.quoteRailLefts[index]!}px`;
      wrapper.append(rail);
    }
  }

  private appendMarker(wrapper: HTMLDivElement, block: BlockLayout, contentInsetX: number): void {
    if (block.markerText === null || block.markerLeft === null || block.markerClassName === null) {
      return;
    }

    const marker = document.createElement("span");
    marker.className = block.markerClassName;
    marker.style.left = `${contentInsetX + block.markerLeft}px`;
    marker.style.top = `${this.markerTop(block)}px`;
    marker.textContent = block.markerText;
    wrapper.append(marker);
  }

  private markerTop(block: BlockLayout): number {
    switch (block.kind) {
      case "code":
        return CODE_BLOCK_PADDING_Y;
      case "inline":
        return Math.max(0, Math.round((block.lineHeight - 12) / 2));
      case "rule":
        return 0;
    }
  }

  private renderInlineFragment(fragment: InlineFragmentLayout): HTMLElement {
    const node =
      fragment.href === null ? document.createElement("span") : document.createElement("a");

    node.className = fragment.className;
    if (fragment.leadingGap > 0) {
      node.style.marginLeft = `${fragment.leadingGap}px`;
    }
    node.textContent = fragment.text;

    if (node instanceof HTMLAnchorElement && fragment.href !== null) {
      node.href = fragment.href;
      node.target = "_blank";
      node.rel = "noreferrer";
    }

    return node;
  }
}
