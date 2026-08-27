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
import type {
  WalliChatBlockAction,
  WalliChatBlockActionCallback,
  WalliChatComposerElement,
  WalliChatElement,
  WalliLoadingElement,
} from "../web-components";
import type { WalliChatTokenizedBlockDefinition } from "../core/block-registry";
import {
  builtInBlocks,
  registerBlock,
  type WalliChatBlockDefinition,
  type WalliChatBlockName,
  type WalliChatBlockRegistration,
  type WalliChatBlockRenderContext,
  type WalliChatBuiltInBlockName,
} from "../core/block-registry";
import type {
  WalliChatMessage,
  WalliChatEndReachedCallback,
  WalliChatEndReachedInfo,
  WalliChatComposerActionCallback,
  WalliChatComposerAsset,
  WalliChatComposerInsertedAssetsHandle,
  WalliChatComposerInsertAsset,
  WalliChatComposerMenuItem,
  WalliChatComposerSetUploadProgress,
  WalliChatComposerSetUploadResult,
  WalliChatComposerSubmitCallback,
  WalliChatComposerTranscribeCallback,
  WalliChatComposerTranscriptionContext,
  WalliChatComposerTranscriptionResult,
  WalliChatComposerUploadImagesCallback,
  WalliChatComposerUploadResult,
  WalliChatComposerValueCallback,
  WalliChatFeedbackCallback,
  WalliChatInsertMessagesOptions,
  WalliChatMessageCallback,
  WalliChatMessagePatch,
  WalliChatRemoveMessages,
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
  menuItems?: readonly WalliChatComposerMenuItem[];
  onCancel?: WalliChatComposerActionCallback;
  onSubmit?: WalliChatComposerSubmitCallback;
  onUploadImages?: WalliChatComposerUploadImagesCallback;
  onValueChange?: WalliChatComposerValueCallback;
  onTranscribe?: WalliChatComposerTranscribeCallback;
  placeholder?: string;
  slot?: string;
  style?: CSSProperties;
  transcribingText?: string;
  uploadImagesTitle?: string;
  value: string;
};

export type WalliLoadingProps = {
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
};

export const WalliLoading = forwardRef<WalliLoadingElement, WalliLoadingProps>(
  function WalliLoading({ ariaLabel = "Loading", className, style }, forwardedRef) {
    return createElement("walli-loading", {
      "aria-label": ariaLabel,
      className,
      ref: forwardedRef,
      style,
    });
  },
);

export type WalliChatComposerRef = {
  readonly element: WalliChatComposerElement | null;
  focus: () => void;
  insertAssets: (
    assets: readonly WalliChatComposerInsertAsset[],
  ) => WalliChatComposerInsertedAssetsHandle | undefined;
};

export const WalliChatComposer = forwardRef<WalliChatComposerRef, WalliChatComposerProps>(
  function WalliChatComposer(
    {
      className,
      disabled = false,
      maxHeight = 200,
      menuItems = [],
      onCancel,
      onSubmit,
      onUploadImages,
      onValueChange,
      onTranscribe,
      placeholder = "Message",
      slot,
      style,
      transcribingText = "Transcribing",
      uploadImagesTitle = "Add files",
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
      element.menuItems = menuItems;
      element.onCancel = onCancel;
      element.onSubmit = onSubmit;
      element.onUploadImages = onUploadImages;
      element.onValueChange = onValueChange;
      element.onTranscribe = onTranscribe;
      element.placeholder = placeholder;
      element.transcribingText = transcribingText;
      element.uploadImagesTitle = uploadImagesTitle;
      element.value = value;
    }, [
      disabled,
      maxHeight,
      menuItems,
      onCancel,
      onSubmit,
      onTranscribe,
      onUploadImages,
      onValueChange,
      placeholder,
      transcribingText,
      uploadImagesTitle,
      value,
    ]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        get element() {
          return elementRef.current;
        },
        focus() {
          elementRef.current?.focus();
        },
        insertAssets(assets) {
          return elementRef.current?.insertAssets(assets);
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
  emptyContent?: ReactNode;
  loading?: boolean;
  messages: readonly WalliChatMessage[];
  onAction?: WalliChatBlockActionCallback;
  onEndReached?: WalliChatEndReachedCallback;
  onEndReachedThreshold?: number;
  onFeedback?: WalliChatFeedbackCallback;
  onReply?: WalliChatMessageCallback;
  onShare?: WalliChatMessageCallback;
  style?: CSSProperties;
};

export type WalliChatRef = {
  readonly element: WalliChatElement | null;
  insertMessagesAtTop: (
    messages: readonly WalliChatMessage[],
    options?: WalliChatInsertMessagesOptions,
  ) => WalliChatRemoveMessages;
  insertMessagesAtBottom: (
    messages: readonly WalliChatMessage[],
    options?: WalliChatInsertMessagesOptions,
  ) => WalliChatRemoveMessages;
  insertStreamingMessageAtBottom: (
    stream: WalliChatTextStream,
    options: WalliChatStreamingOptions,
  ) => WalliChatStreamingHandle;
  replaceMessage: (id: string, patch: WalliChatMessagePatch) => boolean;
  scrollTo: (options: WalliChatScrollToOptions) => void;
  scrollToIndex: (options: WalliChatScrollToIndexOptions) => void;
  registerBlock: {
    <Name extends WalliChatBlockName>(
      definition: WalliChatBlockDefinition<Name>,
    ): WalliChatBlockRegistration;
    <Input, Prepared = Input, Materialized = Prepared>(
      definition: WalliChatTokenizedBlockDefinition<Input, Prepared, Materialized>,
    ): WalliChatBlockRegistration;
  };
};

export const WalliChat = forwardRef<WalliChatRef, WalliChatProps>(function WalliChat(
  {
    bottomOcclusionHeight,
    children,
    className,
    defaultScrollToBottom = true,
    emptyContent,
    loading = false,
    messages,
    onAction,
    onEndReached,
    onEndReachedThreshold = 0,
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
      elementRef.current.loading = loading;
    }
  }, [defaultScrollToBottom, loading]);

  useEffect(() => {
    if (elementRef.current && bottomOcclusionHeight !== undefined) {
      elementRef.current.bottomOcclusionHeight = bottomOcclusionHeight;
    }
  }, [bottomOcclusionHeight]);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.onEndReached = onEndReached;
      elementRef.current.onAction = onAction;
      elementRef.current.onEndReachedThreshold = onEndReachedThreshold;
      elementRef.current.onFeedback = onFeedback;
      elementRef.current.onReply = onReply;
      elementRef.current.onShare = onShare;
    }
  }, [onAction, onEndReached, onEndReachedThreshold, onFeedback, onReply, onShare]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      get element() {
        return elementRef.current;
      },
      insertMessagesAtTop(nextMessages, options) {
        return elementRef.current?.insertMessagesAtTop(nextMessages, options) ?? (() => undefined);
      },
      insertMessagesAtBottom(nextMessages, options) {
        return (
          elementRef.current?.insertMessagesAtBottom(nextMessages, options) ?? (() => undefined)
        );
      },
      insertStreamingMessageAtBottom(stream, options) {
        const element = elementRef.current;
        if (element === null) throw new Error("WalliChat is not mounted.");
        return element.insertStreamingMessageAtBottom(stream, options);
      },
      replaceMessage(id, patch) {
        return elementRef.current?.replaceMessage(id, patch) ?? false;
      },
      scrollTo(options) {
        elementRef.current?.scrollTo(options);
      },
      scrollToIndex(options) {
        elementRef.current?.scrollToIndex(options);
      },
      registerBlock(definition: WalliChatBlockDefinition | WalliChatTokenizedBlockDefinition) {
        return registerBlock(definition as WalliChatBlockDefinition);
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
    emptyContent == null ? null : createElement("div", { slot: "empty-content" }, emptyContent),
    children,
  );
});

export type {
  WalliChatBlockAction,
  WalliChatBlockActionCallback,
  WalliChatBlockDefinition,
  WalliChatBlockName,
  WalliChatBlockRegistration,
  WalliChatBlockRenderContext,
  WalliChatBuiltInBlockName,
  WalliChatTokenizedBlockDefinition,
  WalliChatComposerActionCallback,
  WalliChatComposerAsset,
  WalliChatComposerInsertedAssetsHandle,
  WalliChatComposerInsertAsset,
  WalliChatComposerSetUploadProgress,
  WalliChatComposerSetUploadResult,
  WalliChatComposerSubmitCallback,
  WalliChatComposerTranscribeCallback,
  WalliChatComposerTranscriptionContext,
  WalliChatComposerTranscriptionResult,
  WalliChatComposerUploadImagesCallback,
  WalliChatComposerUploadResult,
  WalliChatComposerValueCallback,
  WalliChatEndReachedCallback,
  WalliChatEndReachedInfo,
  WalliChatMessage,
  WalliChatFeedbackCallback,
  WalliChatInsertMessagesOptions,
  WalliChatMessageCallback,
  WalliChatMessagePatch,
  WalliChatRemoveMessages,
  WalliChatScrollTarget,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
};

export { builtInBlocks, registerBlock };
