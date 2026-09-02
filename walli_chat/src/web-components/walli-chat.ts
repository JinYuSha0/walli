import "./walli-message";
import "./walli-scroll-to-bottom-button";
import "./walli-loading";
import { html, LitElement, nothing } from "lit";
import type { UIMessageChunk } from "ai";
import { customElement, eventOptions, property, query, state } from "lit/decorators.js";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import prismThemeCss from "../core/styles/prism-theme.css?inline";
import walliChatHostCss from "../core/styles/walli-chat.css?inline";
import {
  buildConversationFrame,
  createPreparedChatMessages,
  getMaxChatWidth,
  findVisibleRange,
} from "../core/index";
import type { ConversationFrame, PreparedChatMessage } from "../core/types";
import type { WalliChatBlockContext, WalliChatScrollState } from "../core/block-registry";
import { StreamingMarkdownParser } from "../core/md-parse";
import { parseEventData, ServerSentEventParser, type ServerSentEvent } from "../core/sse-parser";
import { getCommonStyle } from "../core/styles";
import { timeScheduler } from "../core/helper";
import type {
  WalliChatMessage,
  WalliChatEndReachedCallback,
  WalliChatFeedbackCallback,
  WalliChatInsertMessagesOptions,
  WalliChatMessageCallback,
  WalliChatMessagePatch,
  WalliChatBlockActionCallback,
  WalliChatRemoveMessages,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
} from "../types";

import type { WalliMessageElement } from "./walli-message";
import type { WalliChatComposerElement } from "./walli-chat-composer";

export { registerBlock } from "../core/block-registry";

type Size = {
  width: number;
  height: number;
};

type ScrollAnchor = {
  id: string;
  top: number;
};

type PendingScrollRequest = {
  animated: boolean;
  source?: "streaming";
} & ({ index: number } | { target: "top" | "bottom" } | { top: number });

const STREAMING_START_MARKDOWN = ":::start-block\n";

function createReasoningBlockMarkdown(
  text: string,
  complete: boolean,
  collapsed: boolean,
  labels: { thinking: string; thought: string },
): string {
  return `:::reasoning-block\n${JSON.stringify({
    collapsed,
    complete,
    text,
    thinkingLabel: labels.thinking,
    thoughtLabel: labels.thought,
  })}\n:::`;
}

@customElement("walli-chat")
export class WalliChatElement extends LitElement {
  @property({ attribute: false }) accessor emptyContent: unknown;
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  @property({ attribute: false }) accessor onFeedback: WalliChatFeedbackCallback | undefined;
  @property({ attribute: false }) accessor onAction: WalliChatBlockActionCallback | undefined;
  @property({ attribute: false }) accessor onEndReached: WalliChatEndReachedCallback | undefined;
  @property({ attribute: false }) accessor onEndReachedThreshold = 0;
  @property({ attribute: false }) accessor onReply: WalliChatMessageCallback | undefined;
  @property({ attribute: false }) accessor onShare: WalliChatMessageCallback | undefined;
  @property({ attribute: false }) accessor bottomOcclusionHeight =
    getCommonStyle("bottomOcclusionHeight");
  private _messages: readonly WalliChatMessage[] = [];
  private readonly blockStates = new Map<string, Map<string, unknown>>();
  private preparedMessages: PreparedChatMessage[] = [];
  private topInsertedMessageGroups: WalliChatMessage[][] = [];
  private bottomInsertedMessageGroups: WalliChatMessage[][] = [];
  private pendingScrollRequest: PendingScrollRequest | null = null;
  private resizeObserver?: ResizeObserver;
  private composerResizeObserver?: ResizeObserver;
  private scheduledRaf: number | null = null;
  private scheduledScrollRaf: number | null = null;
  private scheduledEndReachedRaf: number | null = null;
  private frame: ConversationFrame | null = null;
  private canvasElement: HTMLDivElement | null = null;
  private viewportElement: HTMLDivElement | null = null;
  private activeTopInsertionScrollFloor: number | null = null;
  private composerOverlayElement: HTMLDivElement | null = null;
  private composerShellElement: HTMLDivElement | null = null;
  @query('slot[name="composer"]') private accessor composerSlotElement!: HTMLSlotElement;
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
        if (isBottomInsertion && !this.isSameMessage(messages[left], previousMessages[left])) {
          isBottomInsertion = false;
        }
        if (
          isTopInsertion &&
          !this.isSameMessage(messages[insertedCount + right], previousMessages[right])
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
    if ("target" in request && request.target === "bottom") {
      this.isUserScrolling = false;
      this.isScrollingToBottom = true;
      this.isAtBottom = true;
      this.activeTopInsertionScrollFloor = null;
      timeScheduler.cancelByType(this.scrollInteractionEndTaskType);
    }
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

  replaceMessage(id: string, patch: WalliChatMessagePatch): boolean {
    const index = this._messages.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const message = { ...this._messages[index]!, ...patch, id };
    const previousMessages = this._messages;
    this._messages = [
      ...previousMessages.slice(0, index),
      message,
      ...previousMessages.slice(index + 1),
    ];
    this.preparedMessages.splice(index, 1, ...createPreparedChatMessages([message]));
    this.requestUpdate("messages", previousMessages);
    this.invalidateFrame({ keepMountedRows: true });
    return true;
  }

  private isSameMessage(left: WalliChatMessage | undefined, right: WalliChatMessage | undefined) {
    return (
      left?.id === right?.id &&
      left?.markdown === right?.markdown &&
      left?.role === right?.role &&
      left?.showActions === right?.showActions
    );
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
      const shouldMaintainAnchor = kind === "top" && this.pendingScrollRequest === null;
      const viewportHeight = this.viewportElement?.clientHeight ?? this.containerSize.height;
      const previousFrame =
        shouldMaintainAnchor && viewportHeight > 0 ? this.prepareFrameForScroll() : null;
      const previousScrollTop = this.viewportElement?.scrollTop ?? this.viewportScrollTop;
      const anchor = previousFrame
        ? this.captureScrollAnchor(
            previousFrame,
            previousScrollTop,
            viewportHeight,
            new Set(nextMessages.map((message) => message.id)),
          )
        : null;
      this._messages = nextMessages;
      this.preparedMessages.splice(start, insertedMessages.length);
      this.requestUpdate("messages", previousMessages);
      this.invalidateFrame({ keepMountedRows: true });
      if (previousFrame) {
        this.maintainScrollAnchor(
          anchor,
          previousFrame.totalHeight,
          this.prepareFrameForScroll(),
          viewportHeight,
        );
      }
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
    this.scheduleProjection();
    const finished = this.consumeStreamingMessage(
      stream,
      abortController.signal,
      options,
      message,
      parser,
    ).finally(() => {
      this.activeStreamingMessageCount--;
      this.scheduleProjection();
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
    let reasoning = "";
    let reasoningComplete = false;
    let reasoningStarted = false;
    const reasoningLabels = {
      thinking: options.reasoningLabels?.thinking ?? "Thinking",
      thought: options.reasoningLabels?.thought ?? "Thought",
    };
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
      const reasoningCollapsed = this.getBlockState(message.id, "reasoningCollapsed") === true;
      const reasoningBlock =
        reasoning.length > 0
          ? createReasoningBlockMarkdown(
              reasoning,
              reasoningComplete,
              reasoningCollapsed,
              reasoningLabels,
            )
          : "";
      const toolBlocks = [...activeToolCalls.values()].map(
        (toolCall) =>
          `:::toolcall-block\n${JSON.stringify({
            label: toolCall.label,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
          })}\n:::`,
      );
      markdown = [
        reasoningBlock,
        text.length > 0
          ? text
          : reasoningStarted || reasoningBlock.length > 0
            ? ""
            : STREAMING_START_MARKDOWN,
        ...toolBlocks,
      ]
        .filter(Boolean)
        .join("\n\n");
      scheduleRender();
    };

    const applyEvent = (event: ServerSentEvent) => {
      const data = parseEventData<UIMessageChunk>(event);
      if (data === null) return;
      if (data.type === "start") return;
      if (data.type === "reasoning-start") {
        reasoningStarted = true;
        return;
      }
      if (data.type === "reasoning-delta") {
        reasoningStarted = true;
        if (typeof data.delta === "string" && data.delta.length > 0) reasoning += data.delta;
        rebuildMarkdown();
        return;
      }
      if (data.type === "reasoning-end" || data.type === "text-start") {
        reasoningComplete = reasoning.length > 0;
        rebuildMarkdown();
        return;
      }
      if (data.type === "text-delta") {
        reasoningComplete = reasoning.length > 0;
        if (typeof data.delta === "string" && data.delta.length > 0) {
          text += data.delta;
          for (const toolCallId of completedToolCallIds) activeToolCalls.delete(toolCallId);
          completedToolCallIds.clear();
        }
        rebuildMarkdown();
        return;
      }
      if (data.type === "tool-input-available") {
        if (typeof data.toolCallId === "string" && typeof data.toolName === "string") {
          activeToolCalls.set(data.toolCallId, {
            label: options.getToolLabel?.(data.toolName),
            toolCallId: data.toolCallId,
            toolName: data.toolName,
          });
        }
        rebuildMarkdown();
        return;
      }
      if (data.type === "tool-output-available" || data.type === "tool-output-error") {
        if (typeof data.toolCallId === "string" && activeToolCalls.has(data.toolCallId)) {
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
      reasoningComplete = reasoning.length > 0;
      const completedMessageIndex = this._messages.indexOf(message);
      const reasoningCollapsed = this.getBlockState(message.id, "reasoningCollapsed") === true;
      markdown = [
        reasoning.length > 0
          ? createReasoningBlockMarkdown(
              reasoning,
              reasoningComplete,
              reasoningCollapsed,
              reasoningLabels,
            )
          : "",
        text,
      ]
        .filter(Boolean)
        .join("\n\n");
      message.markdown = markdown;
      reader?.releaseLock();
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
    this.isScrollingToBottom = true;
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
    const composerSlot = this.composerSlotElement;
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
    if (this.scheduledEndReachedRaf !== null) {
      cancelAnimationFrame(this.scheduledEndReachedRaf);
      this.scheduledEndReachedRaf = null;
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
      this.scheduleEndReachedCheck();
    }
    if (changedProperties.has("onEndReached") || changedProperties.has("onEndReachedThreshold")) {
      this.scheduleEndReachedCheck();
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
    this.scheduleEndReachedCheck();
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
    let scrollTop = viewport?.scrollTop ?? 0;
    if (
      viewport !== null &&
      this.isUserScrolling &&
      this.activeTopInsertionScrollFloor !== null &&
      scrollTop < this.activeTopInsertionScrollFloor
    ) {
      scrollTop = this.activeTopInsertionScrollFloor;
      viewport.scrollTop = scrollTop;
    }
    this.viewportScrollTop = scrollTop;
    if (viewport !== null) {
      const distanceToBottom = Math.max(
        0,
        viewport.scrollHeight - viewport.clientHeight - scrollTop,
      );
      this.updateBottomState(distanceToBottom);
    }
    if (this.isUserScrolling) this.handleScrollInteractionEnd();
    this.scheduleProjection();
    this.scheduleEndReachedCheck();
  }

  private updateBottomState(distanceToBottom: number): void {
    const isAtBottom = distanceToBottom <= getCommonStyle("bottomOcclusionHeight");
    if (this.isScrollingToBottom) {
      if (isAtBottom) this.isScrollingToBottom = false;
    } else {
      this.isAtBottom = isAtBottom;
    }
  }

  private getScrollState(): WalliChatScrollState {
    const viewport = this.viewportElement;
    const scrollTop = viewport?.scrollTop ?? this.viewportScrollTop;
    const viewportHeight = viewport?.clientHeight ?? this.containerSize.height;
    const scrollHeight = viewport?.scrollHeight ?? this.frame?.totalHeight ?? 0;
    return {
      distanceToBottom: Math.max(0, scrollHeight - viewportHeight - scrollTop),
      isAtBottom: this.isAtBottom,
      scrollHeight,
      scrollTop,
      viewportHeight,
    };
  }

  private createBlockContext(): WalliChatBlockContext {
    return {
      isStreaming: this.activeStreamingMessageCount > 0,
      action: this.handleBlockAction,
      getBlockState: (messageId, key) => this.getBlockState(messageId, key),
      getScrollState: () => this.getScrollState(),
      requestRender: () => this.invalidateFrame({ keepMountedRows: true }),
      setBlockState: (messageId, key, value) => this.setBlockState(messageId, key, value),
      insertMessagesAtBottom: (messages, options) => this.insertMessagesAtBottom(messages, options),
      insertMessagesAtTop: (messages, options) => this.insertMessagesAtTop(messages, options),
      scrollTo: (options) => this.scrollTo(options),
      scrollToIndex: (options) => this.scrollToIndex(options),
      submit: (text) => this.submitMessage(text),
    };
  }

  private getBlockState(messageId: string, key: string): unknown {
    return this.blockStates.get(messageId)?.get(key);
  }

  private setBlockState(messageId: string, key: string, value: unknown): void {
    let state = this.blockStates.get(messageId);
    if (state === undefined) {
      state = new Map();
      this.blockStates.set(messageId, state);
    }
    state.set(key, value);
  }

  private readonly handleBlockAction = async (
    action: Parameters<NonNullable<WalliChatBlockActionCallback>>[0],
  ): Promise<boolean> => {
    if (this.onAction === undefined) return false;
    await this.onAction(action);
    return true;
  };

  private async submitMessage(text: string): Promise<boolean> {
    const composer = this.composerSlotElement
      .assignedElements({ flatten: true })
      .find((element) => element.localName === "walli-chat-composer") as
      WalliChatComposerElement | undefined;
    return composer?.submitMessage(text) ?? false;
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
      this.activeTopInsertionScrollFloor = null;
      this.scheduleEndReachedCheck();
    });
  }

  @eventOptions({ passive: true })
  private handleWheel(): void {
    this.handleScrollInteractionStart();
    this.handleScrollInteractionEnd();
  }

  @eventOptions({ passive: true })
  private handleTouchMove(): void {
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
    if (this.isUserScrolling) this.handleScrollInteractionEnd();
  }

  private scheduleProjection(): void {
    if (!this.isConnected || this.scheduledRaf !== null) return;
    this.scheduledRaf = requestAnimationFrame(() => {
      this.scheduledRaf = null;
      if (!this.isConnected || this.canvasElement === null) return;
      this.projectFrame();
    });
  }

  private scheduleEndReachedCheck(): void {
    if (this.scheduledEndReachedRaf !== null) return;
    this.scheduledEndReachedRaf = requestAnimationFrame(() => {
      this.scheduledEndReachedRaf = null;
      const viewport = this.viewportElement;
      if (viewport === null) return;
      this.checkEndReached(
        viewport.scrollTop,
        viewport.clientHeight,
        this.frame?.totalHeight ?? viewport.scrollHeight,
      );
    });
  }

  private projectFrame(): void {
    const canvas = this.canvasElement;
    if (canvas === null) return;

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
      canvas.style.width = `${frame.chatWidth}px`;
      canvas.style.height = `${frame.totalHeight}px`;
      if (this.viewportElement !== null && this.viewportElement.clientWidth !== viewportWidth) {
        this.scheduleProjection();
      }
    }
    this.projectVisibleRows(frame, start, end, forceProjection);
  }

  private checkEndReached(scrollTop: number, viewportHeight: number, contentHeight: number): void {
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
    this.endReachedCallPending = true;
    let result: ReturnType<WalliChatEndReachedCallback>;
    try {
      result = callback({ distanceFromEnd });
    } catch (cause) {
      this.endReachedCallPending = false;
      throw cause;
    }
    if (
      result === null ||
      (typeof result !== "object" && typeof result !== "function") ||
      typeof result.then !== "function"
    ) {
      this.endReachedCallPending = false;
      this.scheduleEndReachedCheck();
      return;
    }

    void Promise.resolve(result).finally(() => {
      this.endReachedCallPending = false;
      this.scheduleEndReachedCheck();
    });
  }

  private scheduleScrollRequest(): void {
    if (!this.isConnected || this.scheduledScrollRaf !== null) return;
    this.scheduledScrollRaf = requestAnimationFrame(() => {
      this.scheduledScrollRaf = null;
      if (!this.isConnected || this.canvasElement === null) return;
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
      const canvas = this.canvasElement;
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
    this.scheduleEndReachedCheck();
    if (!animated) this.scheduleProjection();
  }

  private captureScrollAnchor(
    frame: ConversationFrame,
    scrollTop: number,
    viewportHeight: number,
    nextMessageIds: ReadonlySet<string>,
  ): ScrollAnchor | null {
    const { start } = findVisibleRange(frame, scrollTop, viewportHeight, 0, 0);
    for (let index = start; index < frame.messages.length; index++) {
      const message = frame.messages[index]!;
      if (nextMessageIds.has(message.prepared.id)) {
        return { id: message.prepared.id, top: message.top };
      }
    }
    return null;
  }

  private maintainScrollAnchor(
    anchor: ScrollAnchor | null,
    previousTotalHeight: number,
    frame: ConversationFrame,
    viewportHeight: number,
  ): void {
    const nextAnchor =
      anchor === null
        ? undefined
        : frame.messages.find((message) => message.prepared.id === anchor.id);
    const adjustment =
      anchor !== null && nextAnchor !== undefined
        ? nextAnchor.top - anchor.top
        : frame.totalHeight - previousTotalHeight;
    if (Math.abs(adjustment) < 1) return;
    this.applyScrollAdjustment(adjustment, frame, viewportHeight);
  }

  private applyScrollAdjustment(
    adjustment: number,
    frame: ConversationFrame,
    viewportHeight: number,
  ): void {
    this.contentSize = {
      width: frame.chatWidth,
      height: frame.totalHeight,
    };
    const canvas = this.canvasElement;
    if (canvas !== null) {
      canvas.style.width = `${frame.chatWidth}px`;
      canvas.style.height = `${frame.totalHeight}px`;
    }

    const viewport = this.viewportElement;
    const rawScrollTop = viewport?.scrollTop ?? this.viewportScrollTop;
    if (viewport !== null && rawScrollTop < 0) {
      viewport.scrollTop = 0;
      void viewport.scrollTop;
    }
    const currentScrollTop = Math.max(0, rawScrollTop);
    const scrollTop = Math.max(
      0,
      Math.min(Math.max(0, frame.totalHeight - viewportHeight), currentScrollTop + adjustment),
    );
    if (this.isUserScrolling && adjustment > 0) {
      this.activeTopInsertionScrollFloor = Math.max(
        this.activeTopInsertionScrollFloor ?? 0,
        scrollTop,
      );
    }
    this.viewportScrollTop = scrollTop;
    if (viewport !== null) {
      void viewport.scrollHeight;
      viewport.scrollTop = scrollTop;
    }
    const { start, end } = findVisibleRange(frame, scrollTop, viewportHeight, 0, 0);
    this.projectVisibleRows(frame, start, end, true);
    this.scheduleEndReachedCheck();
  }

  private projectVisibleRows(
    frame: ConversationFrame,
    start: number,
    end: number,
    force: boolean,
  ): void {
    const blockContext = this.createBlockContext();
    if (!force && start === this.mountedStart && end === this.mountedEnd) {
      for (let index = start; index < end; index++) {
        const element = this.mountedMessageElements.get(index);
        if (element !== undefined) {
          element.dataset.index = String(index);
          const message = frame.messages[index]!;
          element.update(message, blockContext);
        }
      }
      return;
    }

    const canvas = this.canvasElement;
    if (canvas === null) return;

    const elementsByMessageId = new Map<string, WalliMessageElement>();
    for (const element of this.mountedMessageElements.values()) {
      const id = element.message?.prepared.id;
      if (id !== undefined) elementsByMessageId.set(id, element);
    }

    const nextMountedElements = new Map<number, WalliMessageElement>();
    let previousElement: WalliMessageElement | null = null;
    for (let index = start; index < end; index++) {
      const message = frame.messages[index]!;
      const existingElement = elementsByMessageId.get(message.prepared.id);
      const element =
        existingElement ?? (document.createElement("walli-message") as WalliMessageElement);
      elementsByMessageId.delete(message.prepared.id);
      element.dataset.index = String(index);
      element.update(message, blockContext);
      nextMountedElements.set(index, element);

      if (existingElement === undefined) {
        if (previousElement === null) canvas.insertBefore(element, canvas.firstChild);
        else previousElement.after(element);
      }
      previousElement = element;
    }
    for (const element of elementsByMessageId.values()) element.remove();

    this.mountedMessageElements = nextMountedElements;
    this.mountedStart = start;
    this.mountedEnd = end;
  }

  private applyMessagesInsertion(
    kind: "top" | "bottom",
    nextMessages: readonly WalliChatMessage[],
    previousMessages: readonly WalliChatMessage[],
    preparationOptions?: { streaming?: boolean },
  ): void {
    const shouldMaintainAnchor = kind === "top" && this.pendingScrollRequest === null;
    const viewportHeight = this.viewportElement?.clientHeight ?? this.containerSize.height;
    const previousFrame =
      shouldMaintainAnchor && viewportHeight > 0 ? this.prepareFrameForScroll() : null;
    const previousScrollTop = this.viewportElement?.scrollTop ?? this.viewportScrollTop;
    const anchor = previousFrame
      ? this.captureScrollAnchor(
          previousFrame,
          previousScrollTop,
          viewportHeight,
          new Set(nextMessages.map((message) => message.id)),
        )
      : null;

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
    if (previousFrame) {
      this.maintainScrollAnchor(
        anchor,
        previousFrame.totalHeight,
        this.prepareFrameForScroll(),
        viewportHeight,
      );
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
          class="chat-viewport absolute inset-0 overflow-auto [overflow-anchor:none]"
          @wheel=${this.handleWheel}
          @touchmove=${this.handleTouchMove}
          @scroll=${this.handleScroll}
          @scrollend=${this.handleScrollEnd}
        >
          <div class="chat-canvas relative mx-auto min-h-full"></div>
        </div>
        ${
          this._messages.length === 0
            ? html`
                <div class="empty-content absolute inset-0 flex items-center justify-center">
                  ${
                    this.emptyContent ??
                    html`<slot name="empty-content">
                      ${this.loading ? html`<walli-loading></walli-loading>` : nothing}
                    </slot>`
                  }
                </div>
              `
            : nothing
        }
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
