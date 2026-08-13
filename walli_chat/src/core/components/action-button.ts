import { html, render, svg, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

export type WalliActionKind = "copy" | "dislike" | "like" | "reply" | "share";
export type WalliActionButtonConfig = {
  kind: WalliActionKind;
  label?: string;
  onAction?: () => void;
  text?: string;
};

const icon = (content: TemplateResult) => svg`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;

const actionLabels: Record<WalliActionKind, string> = {
  copy: "Copy",
  dislike: "Bad response",
  like: "Good response",
  reply: "Reply",
  share: "Share",
};

const actionIcons: Record<WalliActionKind, TemplateResult> = {
  copy: icon(svg`<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>`),
  like: icon(svg`<path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path>`),
  dislike: icon(svg`<path d="M17 14V2"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"></path>`),
  reply: icon(svg`<path d="m9 17-5-5 5-5"></path><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>`),
  share: icon(svg`<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.59 13.51 6.83 3.98"></path><path d="m15.41 6.51-6.82 3.98"></path>`),
};

@customElement("walli-action-button")
export class WalliActionButtonElement extends HTMLElement {
  private config: WalliActionButtonConfig = { kind: "copy" };

  connectedCallback(): void {
    this.renderButton();
  }

  set action(value: WalliActionButtonConfig) {
    this.config = value;
    if (this.isConnected) this.renderButton();
  }

  private performAction(): void {
    if (this.config.kind === "copy") {
      void navigator.clipboard.writeText(this.config.text ?? "");
    }
    this.config.onAction?.();
  }

  private renderButton(): void {
    const label = this.config.label ?? actionLabels[this.config.kind];
    render(html`<button
      class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      type="button"
      title=${label}
      aria-label=${label}
      @click=${() => this.performAction()}
    >${actionIcons[this.config.kind]}</button>`, this);
  }
}
