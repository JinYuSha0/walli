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
import type { WalliChatMessage, WalliChatScrollToIndexOptions } from "../types";

export type WalliChatProps = {
  className?: string;
  defaultScrollToBottom?: boolean;
  messages: readonly WalliChatMessage[];
  style?: CSSProperties;
};

export type WalliChatRef = {
  readonly element: WalliChatElement | null;
  scrollToIndex: (options?: WalliChatScrollToIndexOptions) => void;
};

export const WalliChat = forwardRef<WalliChatRef, WalliChatProps>(function WalliChat(
  { className, defaultScrollToBottom = true, messages, style },
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

  useImperativeHandle(
    forwardedRef,
    () => ({
      get element() {
        return elementRef.current;
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

export type { WalliChatMessage, WalliChatScrollToIndexOptions };
