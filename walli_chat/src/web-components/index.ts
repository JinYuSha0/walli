import { WalliChatElement } from "./walli-chat";
import { WalliChatComposerElement } from "./walli-chat-composer";
import { WalliChatComposerAssetsElement } from "./walli-chat-composer-assets";
import { WalliMessageElement } from "./walli-message";
import { WalliLoadingElement } from "./walli-loading";
import { WalliActionButtonElement } from "./walli-action-button";
import { WalliAssistantMessageActionsElement } from "./walli-assistant-message-actions";
import { WalliUserMessageActionsElement } from "./walli-user-message-actions";

export {
  WalliChatComposerAssetsElement,
  WalliChatComposerElement,
  WalliChatElement,
  WalliMessageElement,
  WalliLoadingElement,
  WalliActionButtonElement,
  WalliAssistantMessageActionsElement,
  WalliUserMessageActionsElement,
};
export type {
  WalliChatBlockAction,
  WalliChatBlockActionCallback,
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
  WalliChatMessage,
  WalliChatEndReachedCallback,
  WalliChatEndReachedInfo,
  WalliChatFeedback,
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
    "walli-assistant-message-actions": WalliAssistantMessageActionsElement;
    "walli-user-message-actions": WalliUserMessageActionsElement;
  }
}
