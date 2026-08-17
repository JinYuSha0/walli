import "../web-components";
import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import type { WalliChatComposerElement, WalliChatElement } from "../web-components";
import {
  type WalliChatCustomBlockDefinition,
  type WalliChatCustomBlockRegistration,
  registerCustomBlock,
} from "../core/blocks/custom-block";
import type {
  WalliChatMessage,
  WalliChatComposerActionCallback,
  WalliChatComposerSubmitCallback,
  WalliChatComposerValueCallback,
  WalliChatFeedbackCallback,
  WalliChatMessageCallback,
  WalliChatScrollTarget,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
} from "../types";

export type WalliChatComposerProps = {
  className?: string;
  disabled?: boolean;
  maxHeight?: number;
  onCancel?: WalliChatComposerActionCallback;
  onSubmit?: WalliChatComposerSubmitCallback;
  onValueChange?: WalliChatComposerValueCallback;
  onVoice?: WalliChatComposerActionCallback;
  placeholder?: string;
  slot?: string;
  style?: CSSProperties;
  value: string;
};

export type WalliChatComposerRef = {
  readonly element: WalliChatComposerElement | null;
  focus: () => void;
};

export const WalliChatComposer = forwardRef<WalliChatComposerRef, WalliChatComposerProps>(
  function WalliChatComposer(
    {
      className,
      disabled = false,
      maxHeight = 200,
      onCancel,
      onSubmit,
      onValueChange,
      onVoice,
      placeholder = "Message",
      slot,
      style,
      value,
    },
    forwardedRef,
  ): ReactElement {
    const elementRef = useRef<WalliChatComposerElement>(null);

    useEffect(() => {
      const element = elementRef.current;
      if (!element) return;
      element.disabled = disabled;
      element.maxHeight = maxHeight;
      element.onCancel = onCancel;
      element.onSubmit = onSubmit;
      element.onValueChange = onValueChange;
      element.onVoice = onVoice;
      element.placeholder = placeholder;
      element.value = value;
    }, [disabled, maxHeight, onCancel, onSubmit, onValueChange, onVoice, placeholder, value]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        get element() {
          return elementRef.current;
        },
        focus() {
          elementRef.current?.focus();
        },
      }),
      [],
    );

    return createElement("walli-chat-composer", {
      className,
      ref: elementRef,
      slot,
      style,
    });
  },
);

export type WalliChatProps = {
  bottomOcclusionHeight?: number;
  children?: ReactNode;
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
  insertMessagesAtTop: (messages: readonly WalliChatMessage[]) => void;
  insertMessagesAtBottom: (messages: readonly WalliChatMessage[]) => void;
  insertStreamingMessageAtBottom: (
    stream: WalliChatTextStream,
    options: WalliChatStreamingOptions,
  ) => WalliChatStreamingHandle;
  scrollTo: (options: WalliChatScrollToOptions) => void;
  scrollToIndex: (options: WalliChatScrollToIndexOptions) => void;
  registerCustomBlock: <T = unknown>(
    definition: WalliChatCustomBlockDefinition<T>,
  ) => WalliChatCustomBlockRegistration;
};

export const WalliChat = forwardRef<WalliChatRef, WalliChatProps>(function WalliChat(
  {
    bottomOcclusionHeight,
    children,
    className,
    defaultScrollToBottom = true,
    messages,
    onFeedback,
    onReply,
    onShare,
    style,
  },
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
    if (elementRef.current && bottomOcclusionHeight !== undefined) {
      elementRef.current.bottomOcclusionHeight = bottomOcclusionHeight;
    }
  }, [bottomOcclusionHeight]);

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
      insertMessagesAtTop(nextMessages) {
        elementRef.current?.insertMessagesAtTop(nextMessages);
      },
      insertMessagesAtBottom(nextMessages) {
        elementRef.current?.insertMessagesAtBottom(nextMessages);
      },
      insertStreamingMessageAtBottom(stream, options) {
        const element = elementRef.current;
        if (element === null) throw new Error("WalliChat is not mounted.");
        return element.insertStreamingMessageAtBottom(stream, options);
      },
      scrollTo(options) {
        elementRef.current?.scrollTo(options);
      },
      scrollToIndex(options) {
        elementRef.current?.scrollToIndex(options);
      },
      registerCustomBlock(definition) {
        return registerCustomBlock(definition);
      },
    }),
    [],
  );

  return createElement(
    "walli-chat",
    {
      className,
      ref: elementRef,
      style,
    },
    children,
  );
});

export type {
  WalliChatComposerActionCallback,
  WalliChatComposerSubmitCallback,
  WalliChatComposerValueCallback,
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
