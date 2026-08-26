import "./walli-action-button";
import { html, render } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("walli-user-message-actions")
export class WalliUserMessageActionsElement extends HTMLElement {
  id = "";
  markdown = "";

  connectedCallback(): void {
    queueMicrotask(() => this.renderActions());
  }

  protected renderActions(): void {
    render(
      html`<div
        class="flex h-10 items-center justify-end gap-1 opacity-100 transition-opacity [@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100"
      >
        <walli-action-button .action=${{ kind: "copy", text: this.markdown }}></walli-action-button>
      </div>`,
      this,
    );
  }
}
