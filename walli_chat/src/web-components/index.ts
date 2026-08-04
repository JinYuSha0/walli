import { WalliChatElement } from "./walli-chat";
import { WalliMessageElement } from "./walli-message";

export { WalliChatElement, WalliMessageElement };
export type { WalliChatMessage } from "../types";

declare global {
  interface HTMLElementTagNameMap {
    "walli-chat": WalliChatElement;
    "walli-message": WalliMessageElement;
  }
}
