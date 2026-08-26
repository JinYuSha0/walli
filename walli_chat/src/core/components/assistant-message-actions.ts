import "./action-button";
import { html, render } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("walli-assistant-message-actions")
export class WalliAssistantMessageActionsElement extends HTMLElement {
  id = "";
  markdown = "";

  connectedCallback(): void {
    queueMicrotask(() => this.renderActions());
  }

  protected renderActions(): void {
    render(
      html`<div class="flex h-[50px] items-start gap-1">
        <walli-action-button .action=${{ kind: "copy", text: this.markdown }}></walli-action-button>
        <walli-action-button
          class="feedback-action"
          .action=${{ kind: "like", onAction: () => this.emit("walli-feedback", { feedback: "like" }) }}
        ></walli-action-button>
        <walli-action-button
          class="feedback-action"
          .action=${{ kind: "dislike", onAction: () => this.emit("walli-feedback", { feedback: "dislike" }) }}
        ></walli-action-button>
        <walli-action-button
          class="reply-action"
          .action=${{ kind: "reply", onAction: () => this.emit("walli-reply") }}
        ></walli-action-button>
        <walli-action-button
          class="share-action"
          .action=${{ kind: "share", onAction: () => this.emit("walli-share") }}
        ></walli-action-button>
      </div>`,
      this,
    );
  }

  private emit(name: string, extra: Record<string, unknown> = {}): void {
    this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        detail: { id: this.id, markdown: this.markdown, ...extra },
      }),
    );
  }
}
