import { css, html, LitElement } from "lit";
import { SignalWatcher } from "@lit-labs/preact-signals";
import { customElement } from "lit/decorators.js";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import { messages, messagesCount } from "../store";

@customElement("walli-chat")
export class WalliChatElement extends SignalWatcher(LitElement) {
  static override styles = css`
    * {
      box-sizing: border-box;
    }
  `;

  override createRenderRoot() {
    const renderRoot = super.createRenderRoot();
    const unoStyle = document.createElement("style");
    unoStyle.textContent = walliChatUnoCss;
    renderRoot.append(unoStyle);
    return renderRoot;
  }

  override render() {
    console.log(messages.value, messagesCount.value);
    return html`
      <div class="h-full w-full overflow-auto">
        <div class="flex w-full flex-col space-y-4 p-4"></div>
      </div>
    `;
  }
}
