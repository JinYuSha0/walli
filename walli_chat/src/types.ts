export type WalliChatLocales = {
  copyCode?: string;
};

import type { IconNode } from "lucide";

export type WalliChatMessageRole = "assistant" | "system" | "user" | (string & {});

export type AssistantBlockMeta = {
  nickname?: string;
  avatarUrl?: string;
  showBubble?: boolean;
};

export type WalliChatMessage = {
  createdAt?: number;
  id: string;

  markdown: string;
  showActions?: boolean;
} & (
  | { role: "assistant"; meta?: AssistantBlockMeta }
  | { role: WalliChatMessageRole; meta?: Record<string, unknown> }
);
export type WalliChatMessagePatch = Partial<WalliChatMessage>;
export type WalliChatDeleteMessages = (
  ids: readonly string[],
  options?: WalliChatDeleteMessagesOptions,
) => number;
export type WalliChatTimeFormatter = (createdAt: number) => string;
export type WalliChatEditConfig = {
  cancelLabel?: string;
  placeholder?: string;
  submitLabel?: string;
};

export type WalliChatActionItemConfig =
  boolean | { label?: string; sort?: number; visible: boolean };
export type WalliChatActionComponentContext = {
  blockStates?: ReadonlyMap<string, unknown>;
  setIcon: (icon?: IconNode, type?: string) => void;
};
export type WalliChatActionComponent = (context: WalliChatActionComponentContext) => unknown;
export type WalliChatCustomActionConfig = {
  component?: WalliChatActionComponent;
  icon?: IconNode;
  label?: string;
  sort?: number;
  visible: boolean;
};
type WalliChatRoleActionConfig<BuiltInAction extends string> = Partial<
  Record<BuiltInAction, WalliChatActionItemConfig | WalliChatCustomActionConfig>
> &
  Record<string, WalliChatActionItemConfig | WalliChatCustomActionConfig | undefined>;
export type WalliChatActionConfig = {
  assistant?: WalliChatRoleActionConfig<"copy" | "feedback" | "share">;
  user?: WalliChatRoleActionConfig<"copy" | "edit">;
};
export type WalliChatMessageType = WalliChatMessage["role"];
export type WalliChatSetActionIcon = (icon?: IconNode, type?: string) => void;
export type WalliChatActionApi = {
  deleteMessages: WalliChatDeleteMessages;
  edit: (messageId: string) => boolean;
  getScrollState: () => {
    distanceToBottom: number;
    isAtBottom: boolean;
    scrollHeight: number;
    scrollTop: number;
    viewportHeight: number;
  };
  insertMessagesAtBottom: (
    messages: readonly WalliChatMessage[],
    options?: WalliChatInsertMessagesOptions,
  ) => WalliChatRemoveMessages;
  insertMessagesAtTop: (
    messages: readonly WalliChatMessage[],
    options?: WalliChatInsertMessagesOptions,
  ) => WalliChatRemoveMessages;
  scrollTo: (options: WalliChatScrollToOptions) => void;
  scrollToIndex: (options: WalliChatScrollToIndexOptions) => void;
  submit: (text: string) => Promise<boolean>;
};
type WalliChatActionData<Data> = 0 extends 1 & Data
  ? { data: Data }
  : [Data] extends [undefined]
    ? unknown
    : { data: Data };
export type WalliChatActionContext<
  MessageType extends WalliChatMessageType = WalliChatMessageType,
  Data = undefined,
> = WalliChatActionApi & {
  messageId: string;
  messageType: MessageType;
  markdown: string;
  getBlockState: (key: string) => unknown;
  setBlockState: (key: string, value: unknown) => void;
} & WalliChatActionData<Data>;
export type WalliChatIconActionContext<
  MessageType extends Exclude<WalliChatMessageType, "system"> = Exclude<
    WalliChatMessageType,
    "system"
  >,
  Data = undefined,
> = WalliChatActionContext<MessageType, Data> & {
  setIcon: WalliChatSetActionIcon;
};
export type WalliChatEditActionData = {
  action: "cancel" | "submit";
  messageIndex: number;
  messages: readonly WalliChatMessage[];
  originalMarkdown: string;
};
export type WalliChatEditAction = WalliChatIconActionContext<"user"> & { type: "edit" };
export type WalliChatBlockAction<Name extends string = string, Data = unknown> = {
  data: Data;
  messageId: string;
  name: Name;
} & Partial<Omit<WalliChatActionContext, "data">>;
export type WalliChatCustomBlockAction<
  Name extends string = string,
  Data = unknown,
> = WalliChatBlockAction<Name, Data>;
export type WalliChatAction<
  CustomActions extends Record<string, unknown> = {},
  BlockActions extends Record<string, unknown> = Record<string, any>,
> =
  | {
      [
        Name in keyof (BlockActions & { "edit-block": WalliChatEditActionData }) & string
      ]: WalliChatActionContext<
        WalliChatMessageType,
        (BlockActions & { "edit-block": WalliChatEditActionData })[Name]
      > & { name: Name; type: "block" };
    }[keyof (BlockActions & { "edit-block": WalliChatEditActionData }) & string]
  | (WalliChatIconActionContext & { type: "copy" })
  | WalliChatEditAction
  | (WalliChatIconActionContext<"assistant"> & { type: "like" })
  | (WalliChatIconActionContext<"assistant"> & { type: "dislike" })
  | (WalliChatIconActionContext<"assistant"> & { type: "share" })
  | {
      [Type in keyof CustomActions & string]: WalliChatIconActionContext<
        Exclude<WalliChatMessageType, "system">,
        CustomActions[Type]
      > & { type: Type };
    }[keyof CustomActions & string];
export type WalliChatActionCallback<
  CustomActions extends Record<string, unknown> = {},
  BlockActions extends Record<string, unknown> = Record<string, any>,
> = {
  bivarianceHack(action: WalliChatAction<CustomActions, BlockActions>): void | PromiseLike<void>;
}["bivarianceHack"];
export type WalliChatRemoveMessages = () => void;
export type WalliChatDeleteMessagesOptions = {
  /** Keep the conversation's current rendered height after deleting messages. */
  maintainHeight: true;
};
export type WalliChatEndReachedInfo = {
  distanceFromEnd: number;
};
export type WalliChatEndReachedCallback = (
  info: WalliChatEndReachedInfo,
) => void | PromiseLike<void>;
export type WalliChatInsertMessagesOptions = {
  /** Defer insertion until all current streams settle, including aborts and errors. */
  waitForStreaming?: boolean;
  /** Animate assistant messages once, when they first become visible. */
  animation?: "slide-in" | false;
  stick?: boolean;
};

export type WalliChatComposerSubmitCallback = (
  markdown: string,
  text: string,
  assets: readonly WalliChatComposerAsset[],
) => void | Promise<void>;
export type WalliChatComposerAsset = {
  file: File;
  type: "file" | "image";
  url: string;
};
export type WalliChatComposerInsertAsset = Omit<WalliChatComposerAsset, "url"> & {
  url?: string;
};
export type WalliChatComposerUploadResult =
  { url: string; error?: never } | { error: Error; url?: never };
export type WalliChatComposerValueCallback = (value: string) => void;
export type WalliChatComposerActionCallback = () => void;
export type WalliChatComposerTranscriptionResult = {
  audio: Blob;
};
export type WalliChatComposerTranscriptionContext = {
  finished: Promise<WalliChatComposerTranscriptionResult>;
  signal: AbortSignal;
  stream: Promise<MediaStream>;
};
export type WalliChatComposerTranscribeCallback = (
  context: WalliChatComposerTranscriptionContext,
) => string | PromiseLike<string>;
export type WalliChatComposerRemoveImageCallback = (image: File) => void | Promise<void>;
export type WalliChatComposerSetUploadProgress = (image: File, progress: number) => void;
export type WalliChatComposerSetUploadResult = (
  image: File,
  result: WalliChatComposerUploadResult,
) => void;
export type WalliChatComposerInsertedAssetsHandle = {
  setProgress: WalliChatComposerSetUploadProgress;
  setResult: WalliChatComposerSetUploadResult;
};
export type WalliChatComposerUploadImagesCallback = (
  images: readonly File[],
  setProgress: WalliChatComposerSetUploadProgress,
  setResult: WalliChatComposerSetUploadResult,
) =>
  | void
  | WalliChatComposerRemoveImageCallback
  | Promise<void | WalliChatComposerRemoveImageCallback>;
export type WalliChatComposerMenuItem = {
  icon: IconNode;
  onClick: WalliChatComposerActionCallback;
  title: string;
};

/** A Vercel AI SDK UI Message Stream (SSE), or a promise for one. */
export type WalliChatTextStream =
  ReadableStream<string | Uint8Array> | PromiseLike<ReadableStream<string | Uint8Array>>;

type WalliChatStreamingOptionsBase = {
  role?: WalliChatMessageRole;
  getToolLabel?: (toolName: string) => string;
  messageId: string;
  reasoningLabels?: {
    thinking?: string;
    thought?: string;
  };
};

export type WalliChatStreamingOptions = WalliChatStreamingOptionsBase &
  (
    | {
        /**
         * Minimum height, in pixels, reserved from the streaming message's top
         * to the bottom. This mode positions once, then does not follow output.
         */
        bottomPaddingHeight: number;
        stickToBottom?: never;
      }
    | {
        bottomPaddingHeight?: never;
        stickToBottom?: boolean;
      }
  );

export type WalliChatStreamingHandle = {
  abort: (reason?: unknown) => void;
  finished: Promise<void>;
  signal: AbortSignal;
};

export type WalliChatScrollTarget = "top" | "bottom";

export type WalliChatScrollToOptions = {
  animated?: boolean;
  target?: WalliChatScrollTarget;
  top?: number;
};

export type WalliChatScrollToIndexOptions = {
  animated?: boolean;
  index: number;
};
