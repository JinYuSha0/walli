import "./style.css";
import { WalliChatElement } from "./components/walli-chat";

declare global {
  interface HTMLElementTagNameMap {
    "chat-list": WalliChatElement;
  }
}
