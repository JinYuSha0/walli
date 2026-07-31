import { html, LitElement } from "lit";
import { SignalWatcher } from "@lit-labs/preact-signals";
import { customElement, eventOptions, state } from "lit/decorators.js";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import {
  buildConversationFrame,
  createPreparedChatMessages,
  findVisibleRange,
  getMaxChatWidth,
  getOcclusionBannerHeight,
  type ChatMessageInstance,
  type ConversationFrame,
  type PreparedChatMessage,
} from "../markdown-chat.model";
import "./walli-message";

type Size = {
  width: number;
  height: number;
};

type VisibleMessage = {
  index: number;
  message: ChatMessageInstance;
};

@customElement("walli-chat")
export class WalliChatElement extends SignalWatcher(LitElement) {
  private readonly preparedMessages: PreparedChatMessage[] = createPreparedChatMessages();
  private resizeObserver?: ResizeObserver;
  private scheduledRaf: number | null = null;
  private frame: ConversationFrame | null = null;

  @state()
  private accessor containerSize: Size = {
    width: this.parentElement?.clientWidth ?? 0,
    height: this.parentElement?.clientHeight ?? 0,
  };

  @state()
  private accessor viewportScrollTop = 0;

  @state()
  private accessor contentSize: Size = {
    width: 0,
    height: 0,
  };

  @state()
  private accessor visibleMessages: VisibleMessage[] = [];

  override connectedCallback() {
    super.connectedCallback();

    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;

      const { width, height } = entry.contentRect;
      if (this.containerSize.width !== width || this.containerSize.height !== height) {
        this.containerSize = { width, height };
        this.scheduleProjection();
      }
    });
  }

  override firstUpdated() {
    const container = this.parentElement ?? this;
    this.resizeObserver?.observe(container);
    this.scheduleProjection();
    void document.fonts.ready.then(() => this.scheduleProjection());
  }

  override disconnectedCallback() {
    if (this.scheduledRaf !== null) {
      cancelAnimationFrame(this.scheduledRaf);
      this.scheduledRaf = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    super.disconnectedCallback();
  }

  override createRenderRoot() {
    const renderRoot = super.createRenderRoot();
    const unoStyle = document.createElement("style");
    unoStyle.textContent = walliChatUnoCss;
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
    const scrollTop = this.viewportScrollTop;
    const occlusionBannerHeight = getOcclusionBannerHeight(viewportHeight);

    const chatWidth = getMaxChatWidth(viewportWidth);
    const previousFrame = this.frame;
    const canReuseFrame =
      previousFrame !== null &&
      previousFrame.chatWidth === chatWidth &&
      previousFrame.occlusionBannerHeight === occlusionBannerHeight;
    const frame = canReuseFrame
      ? previousFrame
      : buildConversationFrame(this.preparedMessages, chatWidth, occlusionBannerHeight);
    const { start, end } = findVisibleRange(
      frame,
      scrollTop,
      viewportHeight,
      occlusionBannerHeight,
      occlusionBannerHeight,
    );

    this.frame = frame;
    this.contentSize = {
      width: frame.chatWidth,
      height: frame.totalHeight,
    };
    this.projectVisibleRows(frame, start, end);
  }

  private projectVisibleRows(frame: ConversationFrame, start: number, end: number): void {
    const visibleMessages: VisibleMessage[] = [];
    for (let index = start; index < end; index++) {
      visibleMessages.push({
        index,
        message: frame.messages[index]!,
      });
    }
    this.visibleMessages = visibleMessages;
  }

  override render() {
    return html`
      <main class="relative h-full w-full overflow-clip bg-background text-foreground font-sans">
        <div class="chat-viewport absolute inset-0 overflow-auto" @scroll=${this.handleScroll}>
          <div
            class="chat-canvas relative mx-auto min-h-full"
            style=${`width: ${this.contentSize.width}px; height: ${this.contentSize.height}px;`}
          >
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
