import { Copy, Reply, Share2, ThumbsDown, ThumbsUp, createElement } from "lucide";
import { html, render } from "lit";
import { customElement } from "lit/decorators.js";

export type WalliActionKind = "copy" | "dislike" | "like" | "reply" | "share";
export type WalliActionButtonConfig = {
  kind: WalliActionKind;
  label?: string;
  onAction?: () => void;
  text?: string;
};

const actionLabels: Record<WalliActionKind, string> = {
  copy: "Copy",
  dislike: "Bad response",
  like: "Good response",
  reply: "Reply",
  share: "Share",
};

const actionIcons: Record<WalliActionKind, () => SVGElement> = {
  copy: () => createActionIcon(Copy),
  dislike: () => createActionIcon(ThumbsDown),
  like: () => createActionIcon(ThumbsUp),
  reply: () => createActionIcon(Reply),
  share: () => createActionIcon(Share2),
};

type LucideIconNode = Parameters<typeof createElement>[0];

function createActionIcon(icon: LucideIconNode): SVGElement {
  return createElement(icon, {
    "aria-hidden": "true",
    height: 18,
    width: 18,
  });
}

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
    render(
      html`<button
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        type="button"
        title=${label}
        aria-label=${label}
        @click=${() => this.performAction()}
      >
        ${actionIcons[this.config.kind]()}
      </button>`,
      this,
    );
  }
}
