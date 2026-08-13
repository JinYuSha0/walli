import { WalliChatElement } from "./walli-chat";
import { WalliMessageElement } from "./walli-message";

export { WalliChatElement, WalliMessageElement };
export type {
  WalliChatMessage,
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
    "walli-message": WalliMessageElement;
  }
}
