import "../web-components";
import { defineComponent, h, ref, watchEffect, type CSSProperties, type PropType } from "vue";
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
  WalliChatEndReachedCallback,
  WalliChatEndReachedInfo,
  WalliChatFeedbackCallback,
  WalliChatInsertMessagesOptions,
  WalliChatMessage,
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

const styleProp = Object as PropType<CSSProperties>;

export const WalliLoading = defineComponent({
  name: "WalliLoading",
  props: {
    ariaLabel: { default: "Loading", type: String },
    class: String,
    style: styleProp,
  },
  setup(props, { expose }) {
    const element = ref<WalliLoadingElement | null>(null);
    expose({ element });
    return () =>
      h("walli-loading", {
        "aria-label": props.ariaLabel,
        class: props.class,
        ref: element,
        style: props.style,
      });
  },
});

export const WalliChatComposer = defineComponent({
  name: "WalliChatComposer",
  inheritAttrs: false,
  props: {
    class: String,
    disabled: { default: false, type: Boolean },
    maxHeight: { default: 200, type: Number },
    menuItems: {
      default: () => [],
      type: Array as PropType<readonly WalliChatComposerMenuItem[]>,
    },
    onCancel: Function as PropType<WalliChatComposerActionCallback>,
    onSubmit: Function as PropType<WalliChatComposerSubmitCallback>,
    onUploadImages: Function as PropType<WalliChatComposerUploadImagesCallback>,
    onTranscribe: Function as PropType<WalliChatComposerTranscribeCallback>,
    placeholder: { default: "Message", type: String },
    slot: String,
    style: styleProp,
    transcribingText: { default: "Transcribing", type: String },
    uploadImagesTitle: { default: "Add files", type: String },
    value: { default: "", type: String },
  },
  emits: {
    "update:value": (_value: string) => true,
    valueChange: (_value: string) => true,
  },
  setup(props, { attrs, emit, expose }) {
    const element = ref<WalliChatComposerElement | null>(null);

    watchEffect(() => {
      const composer = element.value;
      if (!composer) return;
      composer.disabled = props.disabled;
      composer.maxHeight = props.maxHeight;
      composer.menuItems = props.menuItems;
      composer.placeholder = props.placeholder;
      composer.transcribingText = props.transcribingText;
      composer.uploadImagesTitle = props.uploadImagesTitle;
      composer.value = props.value;
      composer.onCancel = props.onCancel;
      composer.onSubmit = props.onSubmit;
      composer.onUploadImages = props.onUploadImages;
      composer.onTranscribe = props.onTranscribe;
      composer.onValueChange = (value) => {
        emit("update:value", value);
        emit("valueChange", value);
      };
    });

    expose({
      element,
      focus: () => element.value?.focus(),
      insertAssets: (assets: readonly WalliChatComposerInsertAsset[]) =>
        element.value?.insertAssets(assets),
    });

    return () =>
      h("walli-chat-composer", {
        ...attrs,
        class: props.class,
        ref: element,
        slot: props.slot,
        style: props.style,
      });
  },
});

export const WalliChat = defineComponent({
  name: "WalliChat",
  inheritAttrs: false,
  props: {
    bottomOcclusionHeight: Number,
    class: String,
    defaultScrollToBottom: { default: true, type: Boolean },
    loading: { default: false, type: Boolean },
    messages: {
      default: () => [],
      type: Array as PropType<readonly WalliChatMessage[]>,
    },
    onAction: Function as PropType<WalliChatBlockActionCallback>,
    onEndReached: Function as PropType<WalliChatEndReachedCallback>,
    onEndReachedThreshold: { default: 0, type: Number },
    style: styleProp,
  },
  emits: {
    action: (_action: WalliChatBlockAction) => true,
    feedback: (_id: string, _markdown: string, _feedback: "like" | "dislike") => true,
    reply: (_id: string, _markdown: string) => true,
    share: (_id: string, _markdown: string) => true,
  },
  setup(props, { attrs, emit, expose, slots }) {
    const element = ref<WalliChatElement | null>(null);

    watchEffect(() => {
      const chat = element.value;
      if (!chat) return;
      chat.messages = props.messages;
      chat.defaultScrollToBottom = props.defaultScrollToBottom;
      chat.loading = props.loading;
      if (props.bottomOcclusionHeight !== undefined) {
        chat.bottomOcclusionHeight = props.bottomOcclusionHeight;
      }
      chat.onEndReached = props.onEndReached;
      chat.onAction = async (action) => {
        await props.onAction?.(action);
        emit("action", action);
      };
      chat.onEndReachedThreshold = props.onEndReachedThreshold;
      chat.onFeedback = (id, markdown, feedback) => {
        emit("feedback", id, markdown, feedback);
      };
      chat.onReply = (id, markdown) => {
        emit("reply", id, markdown);
      };
      chat.onShare = (id, markdown) => {
        emit("share", id, markdown);
      };
    });

    expose({
      element,
      insertMessagesAtTop: (
        messages: readonly WalliChatMessage[],
        options?: WalliChatInsertMessagesOptions,
      ) => element.value?.insertMessagesAtTop(messages, options) ?? (() => undefined),
      insertMessagesAtBottom: (
        messages: readonly WalliChatMessage[],
        options?: WalliChatInsertMessagesOptions,
      ) => element.value?.insertMessagesAtBottom(messages, options) ?? (() => undefined),
      insertStreamingMessageAtBottom: (
        stream: WalliChatTextStream,
        options: WalliChatStreamingOptions,
      ) => {
        if (!element.value) throw new Error("WalliChat is not mounted.");
        return element.value.insertStreamingMessageAtBottom(stream, options);
      },
      replaceMessage: (id: string, patch: WalliChatMessagePatch) =>
        element.value?.replaceMessage(id, patch) ?? false,
      scrollTo: (options: WalliChatScrollToOptions) => element.value?.scrollTo(options),
      scrollToIndex: (options: WalliChatScrollToIndexOptions) =>
        element.value?.scrollToIndex(options),
      registerBlock,
    });

    return () => {
      const children = slots.default?.() ?? [];
      const emptyContent = slots.empty?.();
      if (emptyContent) children.unshift(h("div", { slot: "empty-content" }, emptyContent));
      return h(
        "walli-chat",
        { ...attrs, class: props.class, ref: element, style: props.style },
        children,
      );
    };
  },
});

export type WalliChatComposerExpose = {
  readonly element: WalliChatComposerElement | null;
  focus: () => void;
  insertAssets: (
    assets: readonly WalliChatComposerInsertAsset[],
  ) => WalliChatComposerInsertedAssetsHandle | undefined;
};

export type WalliChatExpose = {
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
  registerBlock: typeof registerBlock;
};

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
  WalliChatFeedbackCallback,
  WalliChatInsertMessagesOptions,
  WalliChatMessage,
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
