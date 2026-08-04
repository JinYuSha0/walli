import "./walli-message";
import { html, LitElement, type PropertyValues } from "lit";
import { customElement, eventOptions, property, state } from "lit/decorators.js";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import {
  buildConversationFrame,
  createPreparedChatMessages,
  getMaxChatWidth,
  findVisibleRange,
} from "../core/index";
import type { ChatMessageInstance, ConversationFrame, PreparedChatMessage } from "../core/type";
import { getCommonStyle } from "../core/styles";
import type { WalliChatMessage, WalliChatScrollToIndexOptions } from "../types";

type Size = {
  width: number;
  height: number;
};

type VisibleMessage = {
  index: number;
  message: ChatMessageInstance;
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
  private viewportElement: HTMLDivElement | null = null;
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

  @state()
  private accessor visibleMessages: VisibleMessage[] = [];

  @property({ attribute: false })
  accessor messages: readonly WalliChatMessage[] = [];

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

    const container = this.parentElement ?? this;
    this.resizeObserver?.observe(container);
    this.scheduleProjection();
    if (this.pendingScrollRequest !== null) {
      this.scheduleScrollRequest();
    }
    void document.fonts.ready.then(() => this.scheduleProjection());
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
    this.viewportElement = null;
    super.disconnectedCallback();
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("messages")) {
      this.preparedMessages = createPreparedChatMessages(this.messages);
      if (!this.hasAppliedDefaultScroll) {
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
    const frame = canReuseFrame
      ? previousFrame
      : buildConversationFrame(this.preparedMessages, chatWidth, occlusionBannerHeight);
    const { start, end } = findVisibleRange(frame, scrollTop, viewportHeight, 0, 0);

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
    this.hasAppliedDefaultScroll = true;
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

    const visibleMessages: VisibleMessage[] = [];
    for (let index = start; index < end; index++) {
      visibleMessages.push({
        index,
        message: frame.messages[index]!,
      });
    }

    this.mountedStart = start;
    this.mountedEnd = end;
    this.visibleMessages = visibleMessages;
  }

  override render() {
    return html`
      <main class="relative h-full w-full overflow-clip bg-background text-foreground font-sans">
        <div class="chat-viewport absolute inset-0 overflow-auto" @scroll=${this.handleScroll}>
          <div class="chat-canvas relative mx-auto min-h-full">
            ${this.visibleMessages.map(
              ({ index, message }) =>
                html`<walli-message .message=${message} data-index=${index}></walli-message>`,
            )}
          </div>
        </div>
      </main>
    `;
  }
}
