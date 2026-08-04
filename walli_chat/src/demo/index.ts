import "../theme.css";
import "../web-components";
import { effect } from "@preact/signals-core";
import { messages } from "./store";
import type { WalliChatElement } from "../web-components";

const chat = document.querySelector<WalliChatElement>("walli-chat");

if (chat) {
  effect(() => {
    chat.messages = messages.value;
  });
}
