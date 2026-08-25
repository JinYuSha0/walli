import "./walli-message";
import "./walli-scroll-to-bottom-button";
import "./walli-loading";
import { html, LitElement, nothing } from "lit";
import { customElement, eventOptions, property, state } from "lit/decorators.js";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import prismThemeCss from "../core/styles/prism-theme.css?inline";
import walliChatHostCss from "../core/styles/walli-chat.css?inline";
import {
  buildConversationFrame,
  createPreparedChatMessages,
  getMaxChatWidth,
  findVisibleRange,
} from "../core/index";
import type { ConversationFrame, PreparedChatMessage } from "../core/type";
import { StreamingMarkdownParser } from "../core/md-parse";
import { parseEventData, ServerSentEventParser, type ServerSentEvent } from "../core/sse-parser";
import { registerStreamBlocks } from "../core/blocks/stream-block";
import { registerLoadingBlock } from "../core/blocks/loading-block";
import { getCommonStyle } from "../core/styles";
import { timeScheduler } from "../core/helper";
import type {
  WalliChatMessage,
  WalliChatEndReachedCallback,
  WalliChatFeedbackCallback,
  WalliChatInsertMessagesOptions,
  WalliChatMessageCallback,
  WalliChatRemoveMessages,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
} from "../types";

import type { WalliMessageElement } from "./walli-message";

export { registerBlock } from "../core/blocks";

type Size = {
  width: number;
  height: number;
};

type PendingScrollRequest = {
  animated: boolean;
  source?: "streaming";
} & ({ index: number } | { target: "top" | "bottom" } | { top: number });

const STREAMING_START_MARKDOWN = ":::start-block\n";

@customElement("walli-chat")
export class WalliChatElement extends LitElement {
  @property({ attribute: false }) accessor emptyContent: unknown;
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  @property({ attribute: false }) accessor onFeedback: WalliChatFeedbackCallback | undefined;
  @property({ attribute: false }) accessor onEndReached: WalliChatEndReachedCallback | undefined;
  @property({ attribute: false }) accessor onEndReachedThreshold = 0;
  @property({ attribute: false }) accessor onReply: WalliChatMessageCallback | undefined;
  @property({ attribute: false }) accessor onShare: WalliChatMessageCallback | undefined;
  @property({ attribute: false }) accessor bottomOcclusionHeight =
    getCommonStyle("bottomOcclusionHeight");
  private _messages: readonly WalliChatMessage[] = [];
  private preparedMessages: PreparedChatMessage[] = [];
  private topInsertedMessageGroups: WalliChatMessage[][] = [];
  private bottomInsertedMessageGroups: WalliChatMessage[][] = [];
  private pendingScrollRequest: PendingScrollRequest | null = null;
  private resizeObserver?: ResizeObserver;
  private composerResizeObserver?: ResizeObserver;
  private scheduledRaf: number | null = null;
  private scheduledScrollRaf: number | null = null;
  private frame: ConversationFrame | null = null;
  private canvasElement: HTMLDivElement | null = null;
  private viewportElement: HTMLDivElement | null = null;
  private composerOverlayElement: HTMLDivElement | null = null;
  private composerShellElement: HTMLDivElement | null = null;
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
  @state() private accessor isAtBottom = true;
  @state() private accessor activeStreamingMessageCount = 0;
  @state() private accessor hasComposer = false;
  @state() private accessor composerBottomInsetHeight = 52 + 24;
  private isScrollingToBottom = false;
  private isUserScrolling = false;
  private endReachedCallPending = false;
  private endReachedContentWindow: string | null = null;
  private readonly scrollInteractionEndTaskType = "scroll-interaction-end";
  private mountedStart = 0;
  private mountedEnd = 0;

  constructor() {
    super();
    registerLoadingBlock();
    registerStreamBlocks();
  }

  @property({ attribute: false })
  get messages(): readonly WalliChatMessage[] {
    return this._messages;
  }

  set messages(messages: readonly WalliChatMessage[]) {
    const previousMessages = this._messages;
    if (Object.is(messages, previousMessages)) return;
    this.topInsertedMessageGroups = [];
    this.bottomInsertedMessageGroups = [];

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
        this.applyMessagesInsertion("bottom", messages, previousMessages);
        return;
      }

      if (isTopInsertion) {
        this.applyMessagesInsertion("top", messages, previousMessages);
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
          ? (optionsOrX.animated ?? false)
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

  insertMessagesAtTop(
    messages: readonly WalliChatMessage[],
    options: WalliChatInsertMessagesOptions = {},
  ): WalliChatRemoveMessages {
    if (messages.length === 0) return () => undefined;

    const insertedMessages = [...messages];
    this.topInsertedMessageGroups.unshift(insertedMessages);
    if (options.stick) {
      this.pendingScrollRequest = { animated: false, target: "top" };
    }
    this.applyMessagesInsertion("top", [...insertedMessages, ...this._messages], this._messages);
    if (options.stick) this.scheduleScrollRequest();
    return this.createInsertedMessagesRemoval("top", insertedMessages);
  }

  insertMessagesAtBottom(
    messages: readonly WalliChatMessage[],
    options: WalliChatInsertMessagesOptions = {},
  ): WalliChatRemoveMessages {
    if (messages.length === 0) return () => undefined;

    const insertedMessages = [...messages];
    this.bottomInsertedMessageGroups.push(insertedMessages);
    if (options.stick) {
      this.isScrollingToBottom = true;
      this.isAtBottom = true;
      this.pendingScrollRequest = { animated: false, target: "bottom" };
    }
    this.applyMessagesInsertion("bottom", [...this._messages, ...insertedMessages], this._messages);
    if (options.stick) this.scheduleScrollRequest();
    return this.createInsertedMessagesRemoval("bottom", insertedMessages);
  }

  private createInsertedMessagesRemoval(
    kind: "top" | "bottom",
    insertedMessages: WalliChatMessage[],
  ): WalliChatRemoveMessages {
    let removed = false;
    return () => {
      if (removed) return;
      const groups =
        kind === "top" ? this.topInsertedMessageGroups : this.bottomInsertedMessageGroups;
      const groupIndex = groups.indexOf(insertedMessages);
      if (groupIndex < 0) return;
      removed = true;

      const previousMessages = this._messages;
      const start =
        kind === "top"
          ? groups.slice(0, groupIndex).reduce((count, group) => count + group.length, 0)
          : previousMessages.length -
            groups.slice(groupIndex).reduce((count, group) => count + group.length, 0);
      groups.splice(groupIndex, 1);
      const end = start + insertedMessages.length;
      const nextMessages = [...previousMessages.slice(0, start), ...previousMessages.slice(end)];
      this._messages = nextMessages;
      this.preparedMessages.splice(start, insertedMessages.length);
      this.requestUpdate("messages", previousMessages);
      this.invalidateFrame({ keepMountedRows: true });
    };
  }

  insertStreamingMessageAtBottom(
    stream: WalliChatTextStream,
    options: WalliChatStreamingOptions,
  ): WalliChatStreamingHandle {
    const abortController = new AbortController();
    const message: WalliChatMessage = {
      id: options.messageId,
      role: "assistant",
      markdown: STREAMING_START_MARKDOWN,
    };
    const parser = new StreamingMarkdownParser();
    this.applyMessagesInsertion("bottom", [...this._messages, message], this._messages, {
      streaming: true,
    });
    if (options.stickToBottom) {
      this.handleScrollToBottom();
    }

    this.activeStreamingMessageCount++;
    const finished = this.consumeStreamingMessage(
      stream,
      abortController.signal,
      options,
      message,
      parser,
    ).finally(() => {
      this.activeStreamingMessageCount--;
    });
    return {
      abort: (reason) => abortController.abort(reason),
      finished,
      signal: abortController.signal,
    };
  }

  private async consumeStreamingMessage(
    stream: WalliChatTextStream,
    signal: AbortSignal,
    options: WalliChatStreamingOptions,
    message: WalliChatMessage,
    parser: StreamingMarkdownParser,
  ): Promise<void> {
    let reader: ReadableStreamDefaultReader<string | Uint8Array> | null = null;
    const decoder = new TextDecoder();
    const eventParser = new ServerSentEventParser();
    const activeToolCalls = new Map<
      string,
      { label?: string; toolCallId: string; toolName: string }
    >();
    const completedToolCallIds = new Set<string>();
    const handleAbort = () => {
      void reader?.cancel(signal.reason).catch(() => undefined);
    };
    signal.addEventListener("abort", handleAbort, { once: true });
    let text = "";
    let markdown = message.markdown;
    let renderedMarkdown = "";
    let renderRaf: number | null = null;
    let resolveRender: (() => void) | null = null;
    let pendingRender: Promise<void> | null = null;

    const finishPendingRender = () => {
      const resolve = resolveRender;
      resolveRender = null;
      resolve?.();
    };

    const scheduleRender = () => {
      if (renderRaf !== null) return;

      pendingRender = new Promise<void>((resolve) => {
        resolveRender = resolve;
      });
      renderRaf = requestAnimationFrame(() => {
        renderRaf = null;
        this.updateStreamingMessage(message, parser, markdown);
        this.requestStreamingFollow();
        renderedMarkdown = markdown;
        finishPendingRender();
      });
    };

    const rebuildMarkdown = () => {
      const toolBlocks = [...activeToolCalls.values()].map(
        (toolCall) =>
          `:::toolcall-block\n${JSON.stringify({
            label: toolCall.label,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
          })}\n:::`,
      );
      markdown = [text.length > 0 ? text : STREAMING_START_MARKDOWN, ...toolBlocks].join("\n\n");
      scheduleRender();
    };

    const applyEvent = (event: ServerSentEvent) => {
      if (event.event === "start") return;
      if (event.event === "delta") {
        const data = parseEventData<{ text?: unknown }>(event);
        if (typeof data?.text === "string" && data.text.length > 0) {
          text += data.text;
          for (const toolCallId of completedToolCallIds) activeToolCalls.delete(toolCallId);
          completedToolCallIds.clear();
        }
        rebuildMarkdown();
        return;
      }
      if (event.event === "tool-call") {
        const data = parseEventData<{ toolCallId?: unknown; toolName?: unknown }>(event);
        if (typeof data?.toolCallId === "string" && typeof data.toolName === "string") {
          activeToolCalls.set(data.toolCallId, {
            label: options.getToolLabel?.(data.toolName),
            toolCallId: data.toolCallId,
            toolName: data.toolName,
          });
        }
        rebuildMarkdown();
        return;
      }
      if (event.event === "tool-result") {
        const data = parseEventData<{ toolCallId?: unknown }>(event);
        if (typeof data?.toolCallId === "string" && activeToolCalls.has(data.toolCallId)) {
          completedToolCallIds.add(data.toolCallId);
        }
        return;
      }
      rebuildMarkdown();
    };

    scheduleRender();

    try {
      reader = (await stream).getReader();
      while (true) {
        if (signal.aborted) {
          await reader.cancel(signal.reason);
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = typeof value === "string" ? value : decoder.decode(value, { stream: true });
        for (const event of eventParser.push(chunk)) applyEvent(event);
      }

      for (const event of eventParser.push(decoder.decode())) applyEvent(event);
      for (const event of eventParser.finish()) applyEvent(event);
      if (pendingRender !== null) await pendingRender;
      if (markdown !== renderedMarkdown) {
        this.updateStreamingMessage(message, parser, markdown);
        this.requestStreamingFollow();
      }
    } finally {
      const shouldRestoreBottomAfterAbort = signal.aborted && this.isAtBottom;
      signal.removeEventListener("abort", handleAbort);
      if (renderRaf !== null) {
        cancelAnimationFrame(renderRaf);
        renderRaf = null;
      }
      finishPendingRender();
      pendingRender = null;
      activeToolCalls.clear();
      completedToolCallIds.clear();
      markdown = text;
      message.markdown = markdown;
      reader?.releaseLock();
      const completedMessageIndex = this._messages.indexOf(message);
      if (completedMessageIndex >= 0) {
        this.preparedMessages[completedMessageIndex] = createPreparedChatMessages([message])[0]!;
      }
      this.invalidateFrame({ keepMountedRows: true });
      await this.updateComplete;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (shouldRestoreBottomAfterAbort) {
        this.handleScrollToBottom();
      }
    }
  }

  private updateStreamingMessage(
    message: WalliChatMessage,
    parser: StreamingMarkdownParser,
    markdown: string,
  ): void {
    const index = this._messages.indexOf(message);
    if (index < 0) return;

    message.markdown = markdown;
    this.preparedMessages[index] = {
      blocks: parser.parse(markdown),
      markdown,
      id: message.id,
      role: "assistant",
      showActions: message.showActions ?? true,
      streaming: true,
    };
    this.invalidateFrame({ keepMountedRows: true });
  }

  private shouldFollowStreamingMessage(): boolean {
    return (
      this.isAtBottom &&
      !this.isUserScrolling &&
      (this.pendingScrollRequest === null || this.pendingScrollRequest.source === "streaming")
    );
  }

  private requestStreamingFollow(): void {
    if (!this.shouldFollowStreamingMessage()) return;
    this.pendingScrollRequest = {
      animated: false,
      source: "streaming",
      target: "bottom",
    };
    this.scheduleScrollRequest();
  }

  override connectedCallback() {
    super.connectedCallback();
    this.hasComposer = this.querySelector('[slot="composer"]') !== null;

    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;

      const { width, height } = entry.contentRect;
      this.updateComposerScrollbarInset();
      if (this.containerSize.width !== width || this.containerSize.height !== height) {
        this.containerSize = { width, height };
        this.scheduleProjection();
        if (this.isAtBottom) {
          this.pendingScrollRequest = { animated: false, target: "bottom" };
          this.scheduleScrollRequest();
        } else if (this.pendingScrollRequest !== null) {
          this.scheduleScrollRequest();
        }
      }
    });
    this.composerResizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const composerHeight = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      this.updateComposerBottomInsetHeight(composerHeight);
    });
  }

  override firstUpdated() {
    this.viewportElement = this.renderRoot.querySelector<HTMLDivElement>(".chat-viewport");
    this.canvasElement = this.renderRoot.querySelector<HTMLDivElement>(".chat-canvas");
    this.composerOverlayElement =
      this.renderRoot.querySelector<HTMLDivElement>(".composer-overlay");
    this.composerShellElement = this.renderRoot.querySelector<HTMLDivElement>(".composer-shell");
    const composerSlot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="composer"]');
    this.hasComposer = (composerSlot?.assignedElements({ flatten: true }).length ?? 0) > 0;
    if (!this.hasComposer) this.composerBottomInsetHeight = 0;
    this.updateComposerScrollbarInset();

    if (this.viewportElement) this.resizeObserver?.observe(this.viewportElement);
    if (this.hasComposer && this.composerShellElement) {
      this.updateComposerBottomInsetHeight(
        this.composerShellElement.getBoundingClientRect().height,
      );
      this.composerResizeObserver?.observe(this.composerShellElement);
    }
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
    timeScheduler.destroy();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.composerResizeObserver?.disconnect();
    this.composerResizeObserver = undefined;
    this.mountedMessageElements.clear();
    this.canvasElement = null;
    this.viewportElement = null;
    this.composerOverlayElement = null;
    this.composerShellElement = null;
    super.disconnectedCallback();
  }

  override updated(changedProperties: Map<PropertyKey, unknown>): void {
    this.toggleAttribute("feedback-enabled", this.onFeedback !== undefined);
    this.toggleAttribute("reply-enabled", this.onReply !== undefined);
    this.toggleAttribute("share-enabled", this.onShare !== undefined);
    if (changedProperties.has("bottomOcclusionHeight")) {
      this.handleBottomOcclusionChange();
    }
    if (changedProperties.has("defaultScrollToBottom")) {
      this.endReachedContentWindow = null;
      this.scheduleProjection();
    }
    if (
      changedProperties.has("onEndReached") ||
      changedProperties.has("onEndReachedThreshold")
    ) {
      this.scheduleProjection();
    }
  }

  private handleFeedback(
    event: CustomEvent<{ id: string; markdown: string; feedback: "like" | "dislike" }>,
  ): void {
    this.onFeedback?.(event.detail.id, event.detail.markdown, event.detail.feedback);
  }

  private handleReply(event: CustomEvent<{ id: string; markdown: string }>): void {
    this.onReply?.(event.detail.id, event.detail.markdown);
  }

  private handleShare(event: CustomEvent<{ id: string; markdown: string }>): void {
    this.onShare?.(event.detail.id, event.detail.markdown);
  }

  private handleComposerSlotChange(event: Event): void {
    const slot = event.currentTarget as HTMLSlotElement;
    const hasComposer = slot.assignedElements({ flatten: true }).length > 0;
    if (this.hasComposer === hasComposer) return;
    this.hasComposer = hasComposer;
    this.composerBottomInsetHeight = hasComposer ? 52 + 24 : 0;
    this.handleBottomOcclusionChange();
  }

  private updateComposerBottomInsetHeight(composerHeight: number): void {
    const bottomPadding = this.composerOverlayElement
      ? Number.parseFloat(getComputedStyle(this.composerOverlayElement).paddingBottom) || 0
      : 0;
    const bottomInsetHeight = composerHeight + bottomPadding;
    if (this.composerBottomInsetHeight === bottomInsetHeight) return;
    this.composerBottomInsetHeight = bottomInsetHeight;
    this.handleBottomOcclusionChange();
  }

  private updateComposerScrollbarInset(): void {
    if (!this.viewportElement || !this.composerOverlayElement) return;
    const scrollbarWidth = this.viewportElement.offsetWidth - this.viewportElement.clientWidth;
    this.composerOverlayElement.style.right = `${scrollbarWidth}px`;
  }

  private handleBottomOcclusionChange(): void {
    this.invalidateFrame({ keepMountedRows: true });
    if (this.isAtBottom) {
      this.pendingScrollRequest = { animated: false, target: "bottom" };
      this.scheduleScrollRequest();
    }
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
    hostStyle.textContent = walliChatHostCss;
    const unoStyle = document.createElement("style");
    unoStyle.textContent = walliChatUnoCss;
    const prismStyle = document.createElement("style");
    prismStyle.textContent = prismThemeCss;
    renderRoot.append(hostStyle);
    renderRoot.append(unoStyle);
    renderRoot.append(prismStyle);
    return renderRoot;
  }

  @eventOptions({ passive: true })
  private handleScroll(event: Event) {
    const viewport = event.currentTarget as HTMLDivElement | null;
    this.viewportScrollTop = viewport?.scrollTop ?? 0;
    if (viewport !== null) {
      const distanceToBottom = Math.max(
        0,
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
      );
      this.updateBottomState(distanceToBottom);
    }
    this.scheduleProjection();
  }

  private updateBottomState(distanceToBottom: number): void {
    const isAtBottom = distanceToBottom <= getCommonStyle("bottomOcclusionHeight");
    if (this.isScrollingToBottom) {
      if (isAtBottom) this.isScrollingToBottom = false;
    } else {
      this.isAtBottom = isAtBottom;
    }
  }

  private handleScrollInteractionStart(): void {
    this.isUserScrolling = true;
    this.isScrollingToBottom = false;
    if (this.pendingScrollRequest?.source === "streaming") {
      this.pendingScrollRequest = null;
    }
    timeScheduler.cancelByType(this.scrollInteractionEndTaskType);
  }

  private handleScrollInteractionEnd(): void {
    timeScheduler.scheduleByType(this.scrollInteractionEndTaskType, Date.now() + 160, () => {
      this.isUserScrolling = false;
    });
  }

  @eventOptions({ passive: true })
  private handleWheel(): void {
    this.handleScrollInteractionStart();
    this.handleScrollInteractionEnd();
  }

  private handleScrollToBottom(): void {
    this.isScrollingToBottom = true;
    this.isAtBottom = true;
    this.scrollTo({ animated: true, target: "bottom" });
  }

  private handleScrollEnd(): void {
    this.isScrollingToBottom = false;
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
    const topOcclusionHeight = getCommonStyle("topOcclusionHeight");
    const bottomOcclusionHeight = this.bottomOcclusionHeight;

    const chatWidth = getMaxChatWidth(viewportWidth);
    if (this.composerShellElement) {
      this.composerShellElement.style.width = `${chatWidth}px`;
    }
    const previousFrame = this.frame;
    const canReuseFrame =
      previousFrame !== null &&
      previousFrame.chatWidth === chatWidth &&
      previousFrame.topOcclusionHeight === topOcclusionHeight &&
      previousFrame.bottomOcclusionHeight === bottomOcclusionHeight &&
      previousFrame.composerBottomInsetHeight === this.composerBottomInsetHeight;

    if (!canReuseFrame) {
      this.frame = buildConversationFrame(
        this.preparedMessages,
        chatWidth,
        topOcclusionHeight,
        bottomOcclusionHeight,
        this.composerBottomInsetHeight,
      );
    }

    const frame = this.frame!;
    const forceProjection = !canReuseFrame;
    const { start, end } = findVisibleRange(frame, scrollTop, viewportHeight, 0, 0);
    this.updateBottomState(Math.max(0, frame.totalHeight - viewportHeight - scrollTop));

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
    this.checkEndReached(scrollTop, viewportHeight, frame.totalHeight);
  }

  private checkEndReached(
    scrollTop: number,
    viewportHeight: number,
    contentHeight: number,
  ): void {
    const callback = this.onEndReached;
    if (
      callback === undefined ||
      this._messages.length === 0 ||
      viewportHeight <= 0 ||
      this.pendingScrollRequest !== null
    ) {
      return;
    }

    const distanceFromEnd = this.defaultScrollToBottom
      ? Math.max(0, scrollTop)
      : Math.max(0, contentHeight - viewportHeight - scrollTop);
    const threshold = Math.max(0, this.onEndReachedThreshold) * viewportHeight;
    if (distanceFromEnd > threshold || this.endReachedCallPending) return;

    const firstMessage = this._messages[0];
    const lastMessage = this._messages[this._messages.length - 1];
    const contentWindow = `${this._messages.length}:${firstMessage?.id ?? ""}:${lastMessage?.id ?? ""}`;
    if (contentWindow === this.endReachedContentWindow) return;

    this.endReachedContentWindow = contentWindow;
    const result = callback({ distanceFromEnd });
    if (
      result === null ||
      (typeof result !== "object" && typeof result !== "function") ||
      typeof result.then !== "function"
    ) {
      return;
    }

    this.endReachedCallPending = true;
    void Promise.resolve(result).finally(() => {
      this.endReachedCallPending = false;
      this.scheduleProjection();
    });
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
    if (!pendingScrollRequest.animated) {
      const { start, end } = findVisibleRange(frame, targetScrollTop, viewportHeight, 0, 0);
      this.projectVisibleRows(frame, start, end, true);
    }
    this.pendingScrollRequest = null;
    void this.updateComplete.then(() => {
      if (pendingScrollRequest.source === "streaming" && this.isUserScrolling) return;
      this.scrollViewportTo(targetScrollTop, pendingScrollRequest.animated);
    });
  }

  private prepareFrameForScroll(): ConversationFrame {
    const viewportWidth = this.viewportElement?.clientWidth ?? this.containerSize.width;
    const topOcclusionHeight = getCommonStyle("topOcclusionHeight");
    const bottomOcclusionHeight = this.bottomOcclusionHeight;
    const chatWidth = getMaxChatWidth(viewportWidth);
    const previousFrame = this.frame;
    const frame =
      previousFrame !== null &&
      previousFrame.chatWidth === chatWidth &&
      previousFrame.topOcclusionHeight === topOcclusionHeight &&
      previousFrame.bottomOcclusionHeight === bottomOcclusionHeight &&
      previousFrame.composerBottomInsetHeight === this.composerBottomInsetHeight
        ? previousFrame
        : buildConversationFrame(
            this.preparedMessages,
            chatWidth,
            topOcclusionHeight,
            bottomOcclusionHeight,
            this.composerBottomInsetHeight,
          );

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
    if (!animated) this.viewportScrollTop = scrollTop;
    this.viewportElement?.scrollTo({
      behavior: animated ? "smooth" : "auto",
      top: scrollTop,
    });
    if (!animated) this.scheduleProjection();
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
    previousMessages: readonly WalliChatMessage[],
    preparationOptions?: { streaming?: boolean },
  ): void {
    const shouldRestoreScrollTop = kind === "top" && this.pendingScrollRequest === null;
    const previousFrame = shouldRestoreScrollTop ? this.prepareFrameForScroll() : null;
    const previousScrollTop = this.viewportElement?.scrollTop ?? this.viewportScrollTop;
    const previousTotalHeight = previousFrame?.totalHeight ?? 0;

    this._messages = nextMessages;
    const insertedCount = nextMessages.length - previousMessages.length;
    if (kind === "top") {
      const insertedMessages = nextMessages.slice(0, insertedCount);
      this.preparedMessages = [
        ...createPreparedChatMessages(insertedMessages, preparationOptions),
        ...this.preparedMessages,
      ];
    } else {
      const insertedMessages = nextMessages.slice(previousMessages.length);
      this.preparedMessages = [
        ...this.preparedMessages,
        ...createPreparedChatMessages(insertedMessages, preparationOptions),
      ];
    }
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
      <main
        class="relative h-full w-full overflow-clip bg-background text-foreground font-sans"
        @walli-feedback=${this.handleFeedback}
        @walli-reply=${this.handleReply}
        @walli-share=${this.handleShare}
      >
        <div
          class="chat-viewport absolute inset-0 overflow-auto"
          @pointerdown=${this.handleScrollInteractionStart}
          @pointerup=${this.handleScrollInteractionEnd}
          @pointercancel=${this.handleScrollInteractionEnd}
          @touchstart=${this.handleScrollInteractionStart}
          @touchend=${this.handleScrollInteractionEnd}
          @touchcancel=${this.handleScrollInteractionEnd}
          @wheel=${this.handleWheel}
          @scroll=${this.handleScroll}
          @scrollend=${this.handleScrollEnd}
        >
          <div class="chat-canvas relative mx-auto min-h-full"></div>
        </div>
        ${this._messages.length === 0
          ? html`
              <div class="empty-content absolute inset-0 flex items-center justify-center">
                ${this.emptyContent ??
                html`<slot name="empty-content">
                  ${this.loading ? html`<walli-loading></walli-loading>` : nothing}
                </slot>`}
              </div>
            `
          : nothing}
        <walli-scroll-to-bottom-button
          class="absolute left-1/2 z-10 [transform:translateX(-50%)]"
          style=${`bottom:${
            this.composerBottomInsetHeight + getCommonStyle("scrollToBottomButtonBottom")
          }px;`}
          .streaming=${this.activeStreamingMessageCount > 0}
          .visible=${!this.isAtBottom}
          @walli-scroll-to-bottom=${this.handleScrollToBottom}
        ></walli-scroll-to-bottom-button>
        <div
          class=${`composer-overlay pointer-events-none absolute bottom-0 left-0 right-0 z-20 ${
            this.hasComposer ? "" : "hidden"
          }`}
        >
          <div class="composer-shell pointer-events-auto mx-auto max-w-full">
            <slot name="composer" @slotchange=${this.handleComposerSlotChange}></slot>
          </div>
        </div>
      </main>
    `;
  }
}
