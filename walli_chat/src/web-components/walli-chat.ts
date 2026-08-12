import "./walli-message";
import { html, LitElement } from "lit";
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
import type {
  WalliChatMessage,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
} from "../types";
import type { WalliMessageElement } from "./walli-message";

type Size = {
  width: number;
  height: number;
};

type PendingScrollRequest = {
  animated: boolean;
} & ({ index: number } | { target: "top" | "bottom" } | { top: number });

@customElement("walli-chat")
export class WalliChatElement extends LitElement {
  private _messages: readonly WalliChatMessage[] = [];
  private preparedMessages: PreparedChatMessage[] = [];
  private pendingScrollRequest: PendingScrollRequest | null = null;
  private resizeObserver?: ResizeObserver;
  private scheduledRaf: number | null = null;
  private scheduledScrollRaf: number | null = null;
  private frame: ConversationFrame | null = null;
  private canvasElement: HTMLDivElement | null = null;
  private viewportElement: HTMLDivElement | null = null;
  private mountedMessageElements = new Map<number, WalliMessageElement>();
  private containerSize: Size = {
    width: this.clientWidth,
    height: this.clientHeight,
  };
  private contentSize: Size = {
    width: 0,
    height: 0,
  };
  private viewportScrollTop = 0;
  private mountedStart = 0;
  private mountedEnd = 0;

  @property({ attribute: false })
  get messages(): readonly WalliChatMessage[] {
    return this._messages;
  }

  set messages(messages: readonly WalliChatMessage[]) {
    const previousMessages = this._messages;
    if (Object.is(messages, previousMessages)) return;

    if (previousMessages.length > 0 && messages.length > previousMessages.length) {
      const insertedCount = messages.length - previousMessages.length;
      let isBottomInsertion = true;
      let isTopInsertion = true;
      let left = 0;
      let right = previousMessages.length - 1;
      while (left <= right && (isBottomInsertion || isTopInsertion)) {
        if (isBottomInsertion && !Object.is(messages[left], previousMessages[left])) {
          isBottomInsertion = false;
        }
        if (
          isTopInsertion &&
          !Object.is(messages[insertedCount + right], previousMessages[right])
        ) {
          isTopInsertion = false;
        }
        left++;
        right--;
      }

      if (isBottomInsertion) {
        this.applyMessagesInsertion(
          "bottom",
          messages,
          messages.slice(previousMessages.length),
          previousMessages,
        );
        return;
      }

      if (isTopInsertion) {
        this.applyMessagesInsertion(
          "top",
          messages,
          messages.slice(0, insertedCount),
          previousMessages,
        );
        return;
      }
    }

    this._messages = messages;
    this.preparedMessages = createPreparedChatMessages(messages);
    this.requestUpdate("messages", previousMessages);
    this.invalidateFrame();

    if (this.defaultScrollToBottom && previousMessages.length === 0 && messages.length > 0) {
      this.pendingScrollRequest = {
        animated: false,
        target: "bottom",
      };
      this.scheduleScrollRequest();
    }
  }

  @property({
    attribute: "default-scroll-to-bottom",
    converter: {
      fromAttribute: (value) => value !== "false",
      toAttribute: (value: boolean) => (value ? "" : "false"),
    },
  })
  accessor defaultScrollToBottom = true;

  scrollToIndex(options: WalliChatScrollToIndexOptions): void {
    this.pendingScrollRequest = {
      animated: options.animated ?? false,
      index: options.index,
    };
    this.scheduleScrollRequest();
  }

  override scrollTo(options: WalliChatScrollToOptions): void;
  override scrollTo(options?: ScrollToOptions): void;
  override scrollTo(x: number, y: number): void;
  override scrollTo(
    optionsOrX: ScrollToOptions | WalliChatScrollToOptions | number = {},
    y = 0,
  ): void {
    const animated =
      typeof optionsOrX === "number"
        ? false
        : "animated" in optionsOrX
          ? optionsOrX.animated ?? false
          : "behavior" in optionsOrX && optionsOrX.behavior === "smooth";
    const request =
      typeof optionsOrX === "number"
        ? { animated, top: y }
        : "target" in optionsOrX && optionsOrX.target !== undefined
          ? { animated, target: optionsOrX.target }
          : { animated, top: optionsOrX.top ?? 0 };
    this.pendingScrollRequest = {
      ...request,
    };
    this.scheduleScrollRequest();
  }

  insertMessagesAtTop(messages: readonly WalliChatMessage[]): void {
    if (messages.length === 0) return;

    this.applyMessagesInsertion("top", [...messages, ...this._messages], messages, this._messages);
  }

  insertMessagesAtBottom(messages: readonly WalliChatMessage[]): void {
    if (messages.length === 0) return;

    this.applyMessagesInsertion(
      "bottom",
      [...this._messages, ...messages],
      messages,
      this._messages,
    );
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

    this.resizeObserver?.observe(this);
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

  private invalidateFrame(options: { keepMountedRows?: boolean } = {}): void {
    this.frame = null;
    this.contentSize = {
      width: 0,
      height: 0,
    };
    if (!options.keepMountedRows) {
      this.mountedStart = 0;
      this.mountedEnd = 0;
      this.mountedMessageElements.clear();
      this.canvasElement?.replaceChildren();
    }
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
    const viewportWidth = this.viewportElement?.clientWidth ?? this.containerSize.width;
    const viewportHeight = this.viewportElement?.clientHeight ?? this.containerSize.height;
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
    const forceProjection = !canReuseFrame;
    const { start, end } = findVisibleRange(frame, scrollTop, viewportHeight, 0, 0);

    if (
      this.contentSize.width !== frame.chatWidth ||
      this.contentSize.height !== frame.totalHeight
    ) {
      this.contentSize = {
        width: frame.chatWidth,
        height: frame.totalHeight,
      };
      const canvas = this.renderRoot.querySelector<HTMLDivElement>(".chat-canvas");
      if (canvas !== null) {
        canvas.style.width = `${frame.chatWidth}px`;
        canvas.style.height = `${frame.totalHeight}px`;
      }
      if (this.viewportElement !== null && this.viewportElement.clientWidth !== viewportWidth) {
        this.scheduleProjection();
      }
    }
    this.projectVisibleRows(frame, start, end, forceProjection);
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
    const viewportHeight = this.viewportElement?.clientHeight ?? this.containerSize.height;
    if (pendingScrollRequest === null || viewportHeight <= 0) return;

    const frame = this.prepareFrameForScroll();
    if (frame.messages.length === 0) return;

    const targetScrollTop = this.resolveScrollTop(frame, pendingScrollRequest, viewportHeight);
    const { start, end } = findVisibleRange(frame, targetScrollTop, viewportHeight, 0, 0);

    this.projectVisibleRows(frame, start, end, true);
    this.pendingScrollRequest = null;
    void this.updateComplete.then(() => {
      this.scrollViewportTo(targetScrollTop, pendingScrollRequest.animated);
    });
  }

  private prepareFrameForScroll(): ConversationFrame {
    const viewportWidth = this.viewportElement?.clientWidth ?? this.containerSize.width;
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
      const canvas = this.renderRoot.querySelector<HTMLDivElement>(".chat-canvas");
      if (canvas !== null) {
        canvas.style.width = `${frame.chatWidth}px`;
        canvas.style.height = `${frame.totalHeight}px`;
      }
      if (this.viewportElement !== null && this.viewportElement.clientWidth !== viewportWidth) {
        this.scheduleProjection();
      }
    }

    return frame;
  }

  private resolveScrollTop(
    frame: ConversationFrame,
    request: PendingScrollRequest,
    viewportHeight: number,
  ): number {
    if (frame.messages.length === 0) return 0;
    const target =
      "target" in request
        ? request.target === "top"
          ? 0
          : frame.totalHeight
        : "top" in request
          ? request.top
        : frame.messages[Math.max(0, Math.min(frame.messages.length - 1, request.index))]!.top;
    return Math.max(0, Math.min(Math.max(0, frame.totalHeight - viewportHeight), target));
  }

  private scrollViewportTo(scrollTop: number, animated: boolean): void {
    this.viewportScrollTop = scrollTop;
    this.viewportElement?.scrollTo({
      behavior: animated ? "smooth" : "auto",
      top: scrollTop,
    });
  }

  private projectVisibleRows(
    frame: ConversationFrame,
    start: number,
    end: number,
    force: boolean,
  ): void {
    if (!force && start === this.mountedStart && end === this.mountedEnd) {
      for (let index = start; index < end; index++) {
        const element = this.mountedMessageElements.get(index);
        if (element !== undefined) {
          element.dataset.index = String(index);
          element.message = frame.messages[index]!;
        }
      }
      return;
    }

    const canvas = this.canvasElement;
    if (canvas === null) return;

    const mountedElementsToCarry = new Map<number, WalliMessageElement>();
    for (let index = this.mountedStart; index < this.mountedEnd; index++) {
      const element = this.mountedMessageElements.get(index);
      if (element === undefined) continue;

      if (index < start || index >= end) {
        element.remove();
        continue;
      }

      element.dataset.index = String(index);
      element.message = frame.messages[index]!;
      mountedElementsToCarry.set(index, element);
    }
    this.mountedMessageElements = mountedElementsToCarry;

    const appendFragment = document.createDocumentFragment();
    for (let index = Math.max(this.mountedEnd, start); index < end; index++) {
      const element = document.createElement("walli-message") as WalliMessageElement;
      element.dataset.index = String(index);
      element.message = frame.messages[index]!;
      this.mountedMessageElements.set(index, element);
      appendFragment.append(element);
    }
    canvas.append(appendFragment);

    let beforeNode = canvas.firstChild;
    for (let index = Math.min(this.mountedStart, end) - 1; index >= start; index--) {
      const element = document.createElement("walli-message") as WalliMessageElement;
      element.dataset.index = String(index);
      element.message = frame.messages[index]!;
      this.mountedMessageElements.set(index, element);
      canvas.insertBefore(element, beforeNode);
      beforeNode = element;
    }

    this.mountedStart = start;
    this.mountedEnd = end;
  }

  private applyMessagesInsertion(
    kind: "top" | "bottom",
    nextMessages: readonly WalliChatMessage[],
    insertedMessages: readonly WalliChatMessage[],
    previousMessages: readonly WalliChatMessage[],
  ): void {
    const shouldRestoreScrollTop = kind === "top" && this.pendingScrollRequest === null;
    const previousFrame = shouldRestoreScrollTop ? this.prepareFrameForScroll() : null;
    const previousScrollTop = this.viewportElement?.scrollTop ?? this.viewportScrollTop;
    const previousTotalHeight = previousFrame?.totalHeight ?? 0;

    this._messages = nextMessages;
    this.preparedMessages =
      kind === "top"
        ? [...createPreparedChatMessages(insertedMessages), ...this.preparedMessages]
        : [...this.preparedMessages, ...createPreparedChatMessages(insertedMessages)];
    this.requestUpdate("messages", previousMessages);
    this.invalidateFrame({ keepMountedRows: true });
    if (shouldRestoreScrollTop) {
      const viewportHeight = this.viewportElement?.clientHeight ?? this.containerSize.height;
      if (viewportHeight <= 0) return;

      const frame = this.prepareFrameForScroll();
      const insertedHeight = frame.totalHeight - previousTotalHeight;
      const scrollTop = Math.max(
        0,
        Math.min(
          Math.max(0, frame.totalHeight - viewportHeight),
          previousScrollTop + insertedHeight,
        ),
      );
      const { start, end } = findVisibleRange(frame, scrollTop, viewportHeight, 0, 0);
      this.projectVisibleRows(frame, start, end, true);
      this.scrollViewportTo(scrollTop, false);
    }
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
