import "./walli-message";
import { html, LitElement, type PropertyValues } from "lit";
import { customElement, eventOptions, property } from "lit/decorators.js";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import {
  buildConversationFrame,
  createPreparedChatMessages,
  getMaxChatWidth,
  findVisibleRange,
} from "../core/index";
import type { ConversationFrame, PreparedChatMessage } from "../core/type";
import { getCommonStyle } from "../core/styles";
import type { WalliChatMessage, WalliChatScrollToIndexOptions } from "../types";
import type { WalliMessageElement } from "./walli-message";

type Size = {
  width: number;
  height: number;
};

type PendingScrollRequest = {
  animated: boolean;
  index?: number;
  position: "top" | "bottom";
};

@customElement("walli-chat")
export class WalliChatElement extends LitElement {
  private preparedMessages: PreparedChatMessage[] = [];
  private pendingScrollRequest: PendingScrollRequest | null = null;
  private hasAppliedDefaultScroll = false;
  private resizeObserver?: ResizeObserver;
  private scheduledRaf: number | null = null;
  private scheduledScrollRaf: number | null = null;
  private frame: ConversationFrame | null = null;
  private canvasElement: HTMLDivElement | null = null;
  private viewportElement: HTMLDivElement | null = null;
  private mountedMessageElements = new Map<number, WalliMessageElement>();
  private containerSize: Size = {
    width: this.parentElement?.clientWidth ?? 0,
    height: this.parentElement?.clientHeight ?? 0,
  };
  private contentSize: Size = {
    width: 0,
    height: 0,
  };
  private viewportScrollTop = 0;
  private mountedStart = 0;
  private mountedEnd = 0;

  @property({ attribute: false })
  accessor messages: readonly WalliChatMessage[] = [];

  @property({
    attribute: "default-scroll-to-bottom",
    converter: {
      fromAttribute: (value) => value !== "false",
      toAttribute: (value: boolean) => (value ? "" : "false"),
    },
  })
  accessor defaultScrollToBottom = true;

  scrollToIndex(options: WalliChatScrollToIndexOptions = {}): void {
    this.pendingScrollRequest = {
      animated: options.animated ?? false,
      index: options.index,
      position: options.position ?? "bottom",
    };
    this.scheduleScrollRequest();
  }

  override connectedCallback() {
    super.connectedCallback();

    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;

      const { width, height } = entry.contentRect;
      if (this.containerSize.width !== width || this.containerSize.height !== height) {
        this.containerSize = { width, height };
        this.scheduleProjection();
        if (this.pendingScrollRequest !== null) {
          this.scheduleScrollRequest();
        }
      }
    });
  }

  override firstUpdated() {
    this.viewportElement = this.renderRoot.querySelector<HTMLDivElement>(".chat-viewport");
    this.canvasElement = this.renderRoot.querySelector<HTMLDivElement>(".chat-canvas");

    const container = this.parentElement ?? this;
    this.resizeObserver?.observe(container);
    this.scheduleProjection();
    if (this.pendingScrollRequest !== null) {
      this.scheduleScrollRequest();
    }
    void document.fonts.ready.then(() => {
      if (this.isConnected) this.scheduleProjection();
    });
  }

  override disconnectedCallback() {
    if (this.scheduledRaf !== null) {
      cancelAnimationFrame(this.scheduledRaf);
      this.scheduledRaf = null;
    }
    if (this.scheduledScrollRaf !== null) {
      cancelAnimationFrame(this.scheduledScrollRaf);
      this.scheduledScrollRaf = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.mountedMessageElements.clear();
    this.canvasElement = null;
    this.viewportElement = null;
    super.disconnectedCallback();
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("messages")) {
      this.preparedMessages = createPreparedChatMessages(this.messages);
      if (this.defaultScrollToBottom && !this.hasAppliedDefaultScroll) {
        this.pendingScrollRequest = {
          animated: false,
          position: "bottom",
        };
        this.scheduleScrollRequest();
      }
      this.invalidateFrame();
    }
  }

  private invalidateFrame(): void {
    this.frame = null;
    this.contentSize = {
      width: 0,
      height: 0,
    };
    this.mountedStart = 0;
    this.mountedEnd = 0;
    this.mountedMessageElements.clear();
    this.canvasElement?.replaceChildren();
    this.scheduleProjection();
  }

  override createRenderRoot() {
    const renderRoot = super.createRenderRoot();
    const hostStyle = document.createElement("style");
    hostStyle.textContent = `
      :host{display:block;width:100%;height:100%;contain:layout paint style;}
    `;
    const unoStyle = document.createElement("style");
    unoStyle.textContent = walliChatUnoCss;
    renderRoot.append(hostStyle);
    renderRoot.append(unoStyle);
    return renderRoot;
  }

  @eventOptions({ passive: true })
  private handleScroll(event: Event) {
    const viewport = event.currentTarget as HTMLDivElement | null;
    this.viewportScrollTop = viewport?.scrollTop ?? 0;
    this.scheduleProjection();
  }

  private scheduleProjection(): void {
    if (this.scheduledRaf !== null) return;
    this.scheduledRaf = requestAnimationFrame(() => {
      this.scheduledRaf = null;
      this.projectFrame();
    });
  }

  private projectFrame(): void {
    const viewportWidth = this.containerSize.width;
    const viewportHeight = this.containerSize.height;
    const scrollTop = this.viewportElement?.scrollTop ?? this.viewportScrollTop;
    this.viewportScrollTop = scrollTop;
    const occlusionBannerHeight = getCommonStyle("occlusionBannerHeight");

    const chatWidth = getMaxChatWidth(viewportWidth);
    const previousFrame = this.frame;
    const canReuseFrame =
      previousFrame !== null &&
      previousFrame.chatWidth === chatWidth &&
      previousFrame.occlusionBannerHeight === occlusionBannerHeight;

    if (!canReuseFrame) {
      this.frame = buildConversationFrame(this.preparedMessages, chatWidth, occlusionBannerHeight);
    }

    const frame = this.frame!;

    const { start, end } = findVisibleRange(frame, scrollTop, viewportHeight, 0, 0);

    if (
      this.contentSize.width !== frame.chatWidth ||
      this.contentSize.height !== frame.totalHeight
    ) {
      this.contentSize = {
        width: frame.chatWidth,
        height: frame.totalHeight,
      };
      this.updateCanvasSize(frame);
    }
    this.projectVisibleRows(frame, start, end, !canReuseFrame);
  }

  private scheduleScrollRequest(): void {
    if (this.scheduledScrollRaf !== null) return;
    this.scheduledScrollRaf = requestAnimationFrame(() => {
      this.scheduledScrollRaf = null;
      this.applyPendingScrollRequest();
    });
  }

  private applyPendingScrollRequest(): void {
    const pendingScrollRequest = this.pendingScrollRequest;
    const viewportHeight = this.containerSize.height;
    if (pendingScrollRequest === null || viewportHeight <= 0) return;

    const frame = this.prepareFrameForScroll();
    if (frame.messages.length === 0) return;

    const targetScrollTop = this.resolveScrollTop(frame, pendingScrollRequest, viewportHeight);
    const { start, end } = findVisibleRange(frame, targetScrollTop, viewportHeight, 0, 0);

    this.projectVisibleRows(frame, start, end, true);
    this.pendingScrollRequest = null;
    if (pendingScrollRequest.index === undefined && pendingScrollRequest.position === "bottom") {
      this.hasAppliedDefaultScroll = true;
    }
    void this.updateComplete.then(() => {
      this.scrollViewportTo(targetScrollTop, pendingScrollRequest.animated);
    });
  }

  private prepareFrameForScroll(): ConversationFrame {
    const viewportWidth = this.containerSize.width;
    const occlusionBannerHeight = getCommonStyle("occlusionBannerHeight");
    const chatWidth = getMaxChatWidth(viewportWidth);
    const previousFrame = this.frame;
    const frame =
      previousFrame !== null &&
      previousFrame.chatWidth === chatWidth &&
      previousFrame.occlusionBannerHeight === occlusionBannerHeight
        ? previousFrame
        : buildConversationFrame(this.preparedMessages, chatWidth, occlusionBannerHeight);

    this.frame = frame;
    if (
      this.contentSize.width !== frame.chatWidth ||
      this.contentSize.height !== frame.totalHeight
    ) {
      this.contentSize = {
        width: frame.chatWidth,
        height: frame.totalHeight,
      };
      this.updateCanvasSize(frame);
    }

    return frame;
  }

  private resolveScrollTop(
    frame: ConversationFrame,
    request: PendingScrollRequest,
    viewportHeight: number,
  ): number {
    if (frame.messages.length === 0) return 0;
    const index = Math.max(
      0,
      Math.min(frame.messages.length - 1, request.index ?? frame.messages.length - 1),
    );
    const message = frame.messages[index]!;
    const target = request.position === "top" ? message.top : message.bottom - viewportHeight;
    return Math.max(0, Math.min(Math.max(0, frame.totalHeight - viewportHeight), target));
  }

  private scrollViewportTo(scrollTop: number, animated: boolean): void {
    this.viewportScrollTop = scrollTop;
    this.viewportElement?.scrollTo({
      behavior: animated ? "smooth" : "auto",
      top: scrollTop,
    });
  }

  private updateCanvasSize(frame: ConversationFrame): void {
    const canvas = this.renderRoot.querySelector<HTMLDivElement>(".chat-canvas");
    if (canvas === null) return;

    canvas.style.width = `${frame.chatWidth}px`;
    canvas.style.height = `${frame.totalHeight}px`;
  }

  private projectVisibleRows(
    frame: ConversationFrame,
    start: number,
    end: number,
    force: boolean,
  ): void {
    if (!force && start === this.mountedStart && end === this.mountedEnd) {
      return;
    }

    const canvas = this.canvasElement;
    if (canvas === null) return;

    for (let index = this.mountedStart; index < this.mountedEnd; index++) {
      if (index < start || index >= end) {
        const element = this.mountedMessageElements.get(index);
        if (element !== undefined) {
          element.remove();
          this.mountedMessageElements.delete(index);
        }
      }
    }

    const appendFragment = document.createDocumentFragment();
    for (let index = Math.max(this.mountedEnd, start); index < end; index++) {
      appendFragment.append(this.createMessageElement(frame, index));
    }
    canvas.append(appendFragment);

    let beforeNode = canvas.firstChild;
    for (let index = Math.min(this.mountedStart, end) - 1; index >= start; index--) {
      const element = this.createMessageElement(frame, index);
      canvas.insertBefore(element, beforeNode);
      beforeNode = element;
    }

    this.mountedStart = start;
    this.mountedEnd = end;
  }

  private createMessageElement(frame: ConversationFrame, index: number): WalliMessageElement {
    const element = document.createElement("walli-message") as WalliMessageElement;
    element.dataset.index = String(index);
    element.message = frame.messages[index]!;
    this.mountedMessageElements.set(index, element);
    return element;
  }

  override render() {
    return html`
      <main class="relative h-full w-full overflow-clip bg-background text-foreground font-sans">
        <div class="chat-viewport absolute inset-0 overflow-auto" @scroll=${this.handleScroll}>
          <div class="chat-canvas relative mx-auto min-h-full"></div>
        </div>
      </main>
    `;
  }
}
