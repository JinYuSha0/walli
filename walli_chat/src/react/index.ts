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
  WalliChatAction,
  WalliChatActionApi,
  WalliChatActionComponent,
  WalliChatActionComponentContext,
  WalliChatActionCallback,
  WalliChatActionConfig,
  WalliChatActionContext,
  WalliChatActionItemConfig,
  WalliChatIconActionContext,
  WalliChatMessageType,
  WalliChatSetActionIcon,
  WalliChatCustomActionConfig,
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
  WalliChatMessageRole,
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
  WalliChatInsertMessagesOptions,
  WalliChatDeleteMessages,
  WalliChatDeleteMessagesOptions,
  WalliChatEditConfig,
  WalliChatMessagePatch,
  WalliChatRemoveMessages,
  WalliChatScrollTarget,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
  WalliChatTimeFormatter,
} from "../types";

export { Trash2 as WalliChatTrashIcon } from "lucide";

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
  responsive?: WalliChatElement["responsive"];
  actionConfig?: WalliChatActionConfig;
  bottomOcclusionHeight?: number;
  children?: ReactNode;
  className?: string;
  defaultScrollToBottom?: boolean;
  defaultScrollToIndex?: number;
  editConfig?: WalliChatEditConfig;
  emptyContent?: ReactNode;
  loading?: boolean;
  messages: readonly WalliChatMessage[];
  onAction?: WalliChatActionCallback;
  onEndReached?: WalliChatEndReachedCallback;
  onEndReachedThreshold?: number;
  style?: CSSProperties;
  timeFormatter?: WalliChatTimeFormatter;
  intervalSeconds?: number;
};

export type WalliChatRef = {
  readonly element: WalliChatElement | null;
  deleteMessages: (ids: readonly string[], options?: WalliChatDeleteMessagesOptions) => number;
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
  registerBlock: typeof registerBlock;
};

export const WalliChat = forwardRef<WalliChatRef, WalliChatProps>(function WalliChat(
  {
    responsive,
    actionConfig,
    bottomOcclusionHeight,
    children,
    className,
    defaultScrollToBottom = true,
    defaultScrollToIndex,
    editConfig,
    emptyContent,
    loading = false,
    messages,
    onAction,
    onEndReached,
    onEndReachedThreshold = 0,
    style,
    timeFormatter,
    intervalSeconds = 0,
  },
  forwardedRef,
): ReactElement {
  const elementRef = useRef<WalliChatElement>(null);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.defaultScrollToBottom = defaultScrollToBottom;
      elementRef.current.defaultScrollToIndex = defaultScrollToIndex;
      elementRef.current.editConfig = editConfig ?? {};
      elementRef.current.messages = messages;
      elementRef.current.timeFormatter = timeFormatter;
      elementRef.current.intervalSeconds = intervalSeconds;
    }
  }, [
    defaultScrollToBottom,
    defaultScrollToIndex,
    editConfig,
    intervalSeconds,
    messages,
    timeFormatter,
  ]);

  useEffect(() => {
    if (elementRef.current) elementRef.current.responsive = responsive;
  }, [responsive]);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.loading = loading;
    }
  }, [loading]);

  useEffect(() => {
    if (elementRef.current && bottomOcclusionHeight !== undefined) {
      elementRef.current.bottomOcclusionHeight = bottomOcclusionHeight;
    }
  }, [bottomOcclusionHeight]);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.onEndReached = onEndReached;
      elementRef.current.onAction = onAction;
      elementRef.current.actionConfig = actionConfig ?? {};
      elementRef.current.onEndReachedThreshold = onEndReachedThreshold;
    }
  }, [actionConfig, onAction, onEndReached, onEndReachedThreshold]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      get element() {
        return elementRef.current;
      },
      deleteMessages(ids, options) {
        return elementRef.current?.deleteMessages(ids, options) ?? 0;
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
      registerBlock,
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
  WalliChatAction,
  WalliChatActionApi,
  WalliChatActionComponent,
  WalliChatActionComponentContext,
  WalliChatActionCallback,
  WalliChatActionConfig,
  WalliChatActionContext,
  WalliChatActionItemConfig,
  WalliChatIconActionContext,
  WalliChatMessageType,
  WalliChatSetActionIcon,
  WalliChatCustomActionConfig,
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
  WalliChatMessageRole,
  WalliChatDeleteMessages,
  WalliChatDeleteMessagesOptions,
  WalliChatEditConfig,
  WalliChatInsertMessagesOptions,
  WalliChatMessagePatch,
  WalliChatRemoveMessages,
  WalliChatScrollTarget,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
  WalliChatTimeFormatter,
};

export { createSystemMessage, systemBlockDefinition } from "../core/blocks/system-block";
export { builtInBlocks, registerBlock };

export { prepareMarkdownContent } from "../core";

export type { WalliChatRoleBlockDefinition } from "../core/block-registry";
