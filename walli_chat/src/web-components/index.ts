import { WalliChatElement } from "./walli-chat";
import { WalliChatComposerElement } from "./walli-chat-composer";
import { WalliMessageElement } from "./walli-message";

export { WalliChatComposerElement, WalliChatElement, WalliMessageElement };
export type {
  WalliChatComposerActionCallback,
  WalliChatComposerSubmitCallback,
  WalliChatComposerValueCallback,
  WalliChatMessage,
  WalliChatFeedback,
  WalliChatFeedbackCallback,
  WalliChatMessageCallback,
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
    "walli-custom-block": HTMLElement;
    "walli-custom-block-content": HTMLElement;
    "walli-message": WalliMessageElement;
  }
}
