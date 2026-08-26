import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("walli-loading")
export class WalliLoadingElement extends LitElement {
  @property({ attribute: "aria-label" }) accessor label = "Loading";

  static override styles = css`
    :host {
      color: var(--muted-foreground, var(--walli-muted-foreground));
      display: inline-block;
      height: 22px;
      position: relative;
      width: 22px;
    }

    i {
      animation: fade 1s linear infinite;
      animation-delay: calc(var(--spinner-index) * 0.083333s - 1s);
      background: currentcolor;
      border-radius: 9999px;
      height: 6px;
      left: 10px;
      opacity: 0.16;
      position: absolute;
      top: 0;
      transform: rotate(calc(var(--spinner-index) * 30deg));
      transform-origin: 1px 11px;
      width: 2px;
    }

    @keyframes fade {
      0% {
        opacity: 1;
      }

      100% {
        opacity: 0.16;
      }
    }
  `;

  override render() {
    return html`
      <span role="status" aria-label=${this.label}>
        ${Array.from(
          { length: 12 },
          (_, index) => html`<i aria-hidden="true" style=${`--spinner-index:${index}`}></i>`,
        )}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "walli-loading": WalliLoadingElement;
  }
}
