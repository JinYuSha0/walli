import { WalliChatElement } from "./walli-chat";
import { WalliMessageElement } from "./walli-message";

export { WalliChatElement, WalliMessageElement };
export type {
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
    "walli-custom-block": HTMLElement;
    "walli-message": WalliMessageElement;
  }
}
