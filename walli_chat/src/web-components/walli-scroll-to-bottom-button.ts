import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";

@customElement("walli-scroll-to-bottom-button")
export class WalliScrollToBottomButtonElement extends LitElement {
  override createRenderRoot() {
    const renderRoot = super.createRenderRoot();
    const unoStyle = document.createElement("style");
    unoStyle.textContent = walliChatUnoCss;
    renderRoot.append(unoStyle);
    return renderRoot;
  }

  @property({ type: Boolean }) accessor streaming = false;
  @property({ reflect: true, type: Boolean }) accessor visible = false;

  private handleClick(): void {
    this.dispatchEvent(
      new CustomEvent("walli-scroll-to-bottom", { bubbles: true, composed: true }),
    );
  }

  override render() {
    return html`<div
      class=${`[-webkit-tap-highlight-color:transparent] transition-[opacity,transform] [transition-duration:160ms] [transition-timing-function:ease] motion-reduce:transition-none ${
        this.visible
          ? "pointer-events-auto opacity-100 [transform:translateY(0)_scale(1)]"
          : "pointer-events-none opacity-0 [transform:translateY(8px)_scale(0.9)]"
      }`}
    >
      <button
        class="[-webkit-appearance:none] [-webkit-backdrop-filter:blur(12px)] [-webkit-tap-highlight-color:transparent] [appearance:none] [backdrop-filter:blur(12px)] [box-shadow:0_2px_10px_rgb(0_0_0_/_12%)] flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-solid border-border bg-scroll-to-bottom p-0 text-foreground outline-none hover:bg-scroll-to-bottom-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        type="button"
        aria-label="Scroll to bottom"
        aria-hidden=${this.visible ? "false" : "true"}
        ?disabled=${!this.visible}
        @click=${this.handleClick}
      >
        ${
          this.streaming
            ? html`<span class="flex items-center gap-[3px]" aria-hidden="true">
                <span
                  class="animate-walli-scroll-to-bottom-dot-pulse h-1 w-1 flex-none rounded-full bg-current"
                ></span>
                <span
                  class="animate-walli-scroll-to-bottom-dot-pulse h-1 w-1 flex-none rounded-full bg-current ![animation-delay:100ms]"
                ></span>
                <span
                  class="animate-walli-scroll-to-bottom-dot-pulse h-1 w-1 flex-none rounded-full bg-current ![animation-delay:200ms]"
                ></span>
              </span>`
            : html`<svg
                class="h-[18px] w-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
                aria-hidden="true"
                viewBox="0 0 24 24"
              >
                <path d="m6 9 6 6 6-6"></path>
              </svg>`
        }
      </button>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "walli-scroll-to-bottom-button": WalliScrollToBottomButtonElement;
  }
}
