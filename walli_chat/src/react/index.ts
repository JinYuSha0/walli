import "../web-components";
import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactElement,
} from "react";
import type { WalliChatElement } from "../web-components";
import type {
  WalliChatMessage,
  WalliChatFeedbackCallback,
  WalliChatMessageCallback,
  WalliChatScrollTarget,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
} from "../types";

export type WalliChatProps = {
  className?: string;
  defaultScrollToBottom?: boolean;
  messages: readonly WalliChatMessage[];
  onFeedback?: WalliChatFeedbackCallback;
  onReply?: WalliChatMessageCallback;
  onShare?: WalliChatMessageCallback;
  style?: CSSProperties;
};

export type WalliChatRef = {
  readonly element: WalliChatElement | null;
  insertMessagesAtBottom: (messages: readonly WalliChatMessage[]) => void;
  insertStreamingMessageAtBottom: (
    stream: WalliChatTextStream,
    options: WalliChatStreamingOptions,
  ) => WalliChatStreamingHandle;
  insertMessagesAtTop: (messages: readonly WalliChatMessage[]) => void;
  scrollTo: (options: WalliChatScrollToOptions) => void;
  scrollToIndex: (options: WalliChatScrollToIndexOptions) => void;
};

export const WalliChat = forwardRef<WalliChatRef, WalliChatProps>(function WalliChat(
  { className, defaultScrollToBottom = true, messages, onFeedback, onReply, onShare, style },
  forwardedRef,
): ReactElement {
  const elementRef = useRef<WalliChatElement>(null);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.messages = messages;
    }
  }, [messages]);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.defaultScrollToBottom = defaultScrollToBottom;
    }
  }, [defaultScrollToBottom]);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.onFeedback = onFeedback;
      elementRef.current.onReply = onReply;
      elementRef.current.onShare = onShare;
    }
  }, [onFeedback, onReply, onShare]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      get element() {
        return elementRef.current;
      },
      insertMessagesAtBottom(nextMessages) {
        elementRef.current?.insertMessagesAtBottom(nextMessages);
      },
      insertStreamingMessageAtBottom(stream, options) {
        const element = elementRef.current;
        if (element === null) throw new Error("WalliChat is not mounted.");
        return element.insertStreamingMessageAtBottom(stream, options);
      },
      insertMessagesAtTop(nextMessages) {
        elementRef.current?.insertMessagesAtTop(nextMessages);
      },
      scrollTo(options) {
        elementRef.current?.scrollTo(options);
      },
      scrollToIndex(options) {
        elementRef.current?.scrollToIndex(options);
      },
    }),
    [],
  );

  return createElement("walli-chat", {
    className,
    ref: elementRef,
    style,
  });
});

export type {
  WalliChatMessage,
  WalliChatFeedbackCallback,
  WalliChatMessageCallback,
  WalliChatScrollTarget,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
};
