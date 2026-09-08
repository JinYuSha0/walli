import { WalliChatElement } from "./walli-chat";
import { WalliChatComposerElement } from "./walli-chat-composer";
import { WalliChatComposerAssetsElement } from "./walli-chat-composer-assets";
import { WalliMessageElement } from "./walli-message";
import { WalliLoadingElement } from "./walli-loading";
import { WalliActionButtonElement } from "./walli-action-button";
import { WalliMessageActionsElement } from "./walli-message-actions";
import { WalliTooltipElement } from "./walli-tooltip";

export {
  WalliChatComposerAssetsElement,
  WalliChatComposerElement,
  WalliChatElement,
  WalliMessageElement,
  WalliLoadingElement,
  WalliActionButtonElement,
  WalliMessageActionsElement,
  WalliTooltipElement,
};
export type {
  WalliChatBlockAction,
  WalliChatCustomBlockAction,
  WalliChatAction,
  WalliChatActionApi,
  WalliChatActionComponent,
  WalliChatActionComponentContext,
  WalliChatActionCallback,
  WalliChatActionConfig,
  WalliChatActionContext,
  WalliChatActionItemConfig,
  WalliChatIconActionContext,
  WalliChatComposerActionCallback,
  WalliChatComposerAsset,
  WalliChatComposerInsertedAssetsHandle,
  WalliChatComposerInsertAsset,
  WalliChatComposerMenuItem,
  WalliChatComposerRemoveImageCallback,
  WalliChatComposerSetUploadProgress,
  WalliChatComposerSetUploadResult,
  WalliChatComposerSubmitCallback,
  WalliChatComposerTranscribeCallback,
  WalliChatComposerTranscriptionContext,
  WalliChatComposerTranscriptionResult,
  WalliChatComposerUploadImagesCallback,
  WalliChatComposerUploadResult,
  WalliChatComposerValueCallback,
  WalliChatCustomActionConfig,
  WalliChatDeleteMessages,
  WalliChatDeleteMessagesOptions,
  WalliChatEditActionData,
  WalliChatEditConfig,
  WalliChatLocales,
  WalliChatMessage,
  WalliChatMessageRole,
  WalliChatMessageType,
  WalliChatEndReachedCallback,
  WalliChatEndReachedInfo,
  WalliChatInsertMessagesOptions,
  WalliChatMessagePatch,
  WalliChatRemoveMessages,
  WalliChatSetActionIcon,
  WalliChatScrollTarget,
  WalliChatScrollToIndexOptions,
  WalliChatScrollToOptions,
  WalliChatStreamingHandle,
  WalliChatStreamingOptions,
  WalliChatTextStream,
  WalliChatTimeFormatter,
} from "../types";

declare global {
  interface HTMLElementTagNameMap {
    "walli-chat": WalliChatElement;
    "walli-chat-composer": WalliChatComposerElement;
    "walli-chat-composer-assets": WalliChatComposerAssetsElement;
    "walli-custom-block": HTMLElement;
    "walli-custom-block-content": HTMLElement;
    "walli-message": WalliMessageElement;
    "walli-loading": WalliLoadingElement;
    "walli-action-button": WalliActionButtonElement;
    "walli-message-actions": WalliMessageActionsElement;
  }
}
