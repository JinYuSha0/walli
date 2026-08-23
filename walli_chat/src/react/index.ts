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
import type { WalliChatTokenizedBlockDefinition } from "../core/blocks/custom-block";
import {
  builtInBlocks,
  registerBlock,
  type WalliChatBlockDefinition,
  type WalliChatBlockName,
  type WalliChatBlockRegistration,
  type WalliChatBlockRenderContext,
  type WalliChatBuiltInBlockName,
} from "../core/blocks";
import type {
  WalliChatMessage,
  WalliChatComposerActionCallback,
  WalliChatComposerAsset,
  WalliChatComposerInsertedAssetsHandle,
  WalliChatComposerInsertAsset,
  WalliChatComposerMenuItem,
  WalliChatComposerSetUploadProgress,
  WalliChatComposerSetUploadResult,
  WalliChatComposerSubmitCallback,
  WalliChatComposerUploadImagesCallback,
  WalliChatComposerUploadResult,
  WalliChatComposerValueCallback,
  WalliChatFeedbackCallback,
  WalliChatMessageCallback,
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
  onVoice?: WalliChatComposerActionCallback;
  placeholder?: string;
  slot?: string;
  style?: CSSProperties;
  uploadImagesTitle?: string;
  value: string;
};

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
      onVoice,
      placeholder = "Message",
      slot,
      style,
      uploadImagesTitle = "Add photos",
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
      element.onVoice = onVoice;
      element.placeholder = placeholder;
      element.uploadImagesTitle = uploadImagesTitle;
      element.value = value;
    }, [disabled, maxHeight, menuItems, onCancel, onSubmit, onUploadImages, onValueChange, onVoice, placeholder, uploadImagesTitle, value]);

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
  messages: readonly WalliChatMessage[];
  onFeedback?: WalliChatFeedbackCallback;
  onReply?: WalliChatMessageCallback;
  onShare?: WalliChatMessageCallback;
  style?: CSSProperties;
};

export type WalliChatRef = {
  readonly element: WalliChatElement | null;
  insertMessagesAtTop: (messages: readonly WalliChatMessage[]) => WalliChatRemoveMessages;
  insertMessagesAtBottom: (messages: readonly WalliChatMessage[]) => WalliChatRemoveMessages;
  insertStreamingMessageAtBottom: (
    stream: WalliChatTextStream,
    options: WalliChatStreamingOptions,
  ) => WalliChatStreamingHandle;
  scrollTo: (options: WalliChatScrollToOptions) => void;
  scrollToIndex: (options: WalliChatScrollToIndexOptions) => void;
  registerBlock: {
    <Name extends WalliChatBlockName>(
      definition: WalliChatBlockDefinition<Name>,
    ): WalliChatBlockRegistration;
    <T>(definition: WalliChatTokenizedBlockDefinition<T>): WalliChatBlockRegistration;
  };
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
        return elementRef.current?.insertMessagesAtTop(nextMessages) ?? (() => undefined);
      },
      insertMessagesAtBottom(nextMessages) {
        return elementRef.current?.insertMessagesAtBottom(nextMessages) ?? (() => undefined);
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
      registerBlock(
        definition: WalliChatBlockDefinition | WalliChatTokenizedBlockDefinition,
      ) {
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
    children,
  );
});

export type {
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
  WalliChatComposerUploadImagesCallback,
  WalliChatComposerUploadResult,
  WalliChatComposerValueCallback,
  WalliChatMessage,
  WalliChatFeedbackCallback,
  WalliChatMessageCallback,
  WalliChatRemoveMessages,
  WalliChatScrollTarget,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
};

export { builtInBlocks, registerBlock };
