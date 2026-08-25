import { WalliChatElement } from "./walli-chat";
import { WalliChatComposerElement } from "./walli-chat-composer";
import { WalliChatComposerAssetsElement } from "./walli-chat-composer-assets";
import { WalliMessageElement } from "./walli-message";
import { WalliLoadingElement } from "./walli-loading";

export {
  WalliChatComposerAssetsElement,
  WalliChatComposerElement,
  WalliChatElement,
  WalliMessageElement,
  WalliLoadingElement,
};
export type {
  WalliChatComposerActionCallback,
  WalliChatComposerAsset,
  WalliChatComposerInsertedAssetsHandle,
  WalliChatComposerInsertAsset,
  WalliChatComposerMenuItem,
  WalliChatComposerRemoveImageCallback,
  WalliChatComposerSetUploadProgress,
  WalliChatComposerSetUploadResult,
  WalliChatComposerSubmitCallback,
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
  }
}
