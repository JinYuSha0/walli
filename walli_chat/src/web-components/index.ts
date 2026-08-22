import { WalliChatElement } from "./walli-chat";
import { WalliChatComposerElement } from "./walli-chat-composer";
import { WalliChatComposerAssetsElement } from "./walli-chat-composer-assets";
import { WalliMessageElement } from "./walli-message";

export {
  WalliChatComposerAssetsElement,
  WalliChatComposerElement,
  WalliChatElement,
  WalliMessageElement,
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
  WalliChatFeedback,
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

declare global {
  interface HTMLElementTagNameMap {
    "walli-chat": WalliChatElement;
    "walli-chat-composer": WalliChatComposerElement;
    "walli-chat-composer-assets": WalliChatComposerAssetsElement;
    "walli-custom-block": HTMLElement;
    "walli-custom-block-content": HTMLElement;
    "walli-message": WalliMessageElement;
  }
}
