import type { IconNode } from "lucide";

export type WalliChatMessage = {
  createdAt?: number;
  id: string;
  meta?: unknown;
  role: "assistant" | "system" | "user";
  markdown: string;
  showActions?: boolean;
};
export type WalliChatMessagePatch = Partial<WalliChatMessage>;
export type WalliChatTimeFormatter = (createdAt: number) => string;

export type WalliChatFeedback = "like" | "dislike";
export type WalliChatActionItemConfig = boolean | { sort?: number; visible: boolean };
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
  type: string;
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
export type WalliChatActionContext<
  MessageType extends WalliChatMessageType = WalliChatMessageType,
> = {
  messageId: string;
  messageType: MessageType;
  markdown: string;
  getBlockState: (key: string) => unknown;
  setBlockState: (key: string, value: unknown) => void;
};
export type WalliChatIconActionContext<
  MessageType extends Exclude<WalliChatMessageType, "system"> = Exclude<
    WalliChatMessageType,
    "system"
  >,
> = WalliChatActionContext<MessageType> & {
  setIcon: WalliChatSetActionIcon;
};
export type WalliChatBlockAction = {
  data: unknown;
  messageId: string;
  name: string;
} & Partial<WalliChatActionContext>;
export type WalliChatAction =
  | (WalliChatActionContext & Omit<WalliChatBlockAction, "messageId"> & { type: "block" })
  | (WalliChatIconActionContext & { type: "copy" })
  | (WalliChatIconActionContext<"user"> & { type: "edit" })
  | (WalliChatIconActionContext<"assistant"> & {
      feedback: WalliChatFeedback;
      type: "feedback";
    })
  | (WalliChatIconActionContext<"assistant"> & { type: "share" })
  | (WalliChatIconActionContext & { type: string });
export type WalliChatActionCallback = (action: WalliChatAction) => void | PromiseLike<void>;
export type WalliChatRemoveMessages = () => void;
export type WalliChatEndReachedInfo = {
  distanceFromEnd: number;
};
export type WalliChatEndReachedCallback = (
  info: WalliChatEndReachedInfo,
) => void | PromiseLike<void>;
export type WalliChatInsertMessagesOptions = {
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
