import "./style.css";
import { WalliChatElement } from "./components/walli-chat";
import "./components/walli-message";
import type { WalliMessageElement } from "./components/walli-message";

declare global {
  interface HTMLElementTagNameMap {
    "walli-chat": WalliChatElement;
    "walli-message": WalliMessageElement;
  }
}
