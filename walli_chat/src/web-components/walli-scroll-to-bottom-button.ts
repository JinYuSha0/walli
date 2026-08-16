import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("walli-scroll-to-bottom-button")
export class WalliScrollToBottomButtonElement extends LitElement {
  static override styles = css`
    :host {
      left: 50%;
      opacity: 0;
      pointer-events: none;
      position: absolute;
      transform: translate(-50%, 8px) scale(0.9);
      transition:
        opacity 160ms ease,
        transform 160ms ease;
      z-index: 10;
    }

    :host([visible]) {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, 0) scale(1);
    }

    button {
      align-items: center;
      background: var(--background);
      border: 1px solid var(--border);
      border-radius: 999px;
      box-shadow: 0 2px 10px rgb(0 0 0 / 12%);
      color: var(--foreground);
      cursor: pointer;
      display: flex;
      height: 32px;
      justify-content: center;
      padding: 0;
      width: 32px;
    }

    button:hover {
      background: var(--accent);
    }

    svg {
      fill: none;
      height: 18px;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
      width: 18px;
    }

    .streaming-indicator {
      align-items: center;
      display: flex;
      gap: 3px;
    }

    .streaming-indicator span {
      animation: pulse 1s ease-in-out infinite;
      background: currentColor;
      border-radius: 999px;
      height: 4px;
      opacity: 0.35;
      width: 4px;
    }

    .streaming-indicator span:nth-child(2) {
      animation-delay: 160ms;
    }

    .streaming-indicator span:nth-child(3) {
      animation-delay: 320ms;
    }

    @keyframes pulse {
      50% {
        opacity: 1;
        transform: translateY(-1.5px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        transition: none;
      }

      .streaming-indicator span {
        animation: none;
      }
    }
  `;

  @property({ type: Boolean }) accessor streaming = false;
  @property({ reflect: true, type: Boolean }) accessor visible = false;

  private handleClick(): void {
    this.dispatchEvent(new CustomEvent("walli-scroll-to-bottom", { bubbles: true, composed: true }));
  }

  override render() {
    return html`<button
      type="button"
      aria-label="滚动到底部"
      aria-hidden=${this.visible ? "false" : "true"}
      ?disabled=${!this.visible}
      @click=${this.handleClick}
    >
      ${this.streaming
        ? html`<span class="streaming-indicator" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>`
        : html`<svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6"></path>
          </svg>`}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "walli-scroll-to-bottom-button": WalliScrollToBottomButtonElement;
  }
}
