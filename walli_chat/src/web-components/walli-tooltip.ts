import { getSpace } from "../core/styles/config";
import clsx from "clsx";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import { html, LitElement, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";

/** A mouse-hover label shown above clipping containers. */
@customElement("walli-tooltip")
export class WalliTooltipElement extends LitElement {
  @property() accessor label = "";
  @property() accessor placement: "top" | "bottom" = "bottom";

  static styles = unsafeCSS(walliChatUnoCss);

  disconnectedCallback() {
    this.hide();
    super.disconnectedCallback();
  }

  protected updated() {
    if (!this.label.trim()) this.hide();
  }

  protected render() {
    return html`<span
        class="inline-flex"
        @pointerenter=${(event: PointerEvent) => {
          if (event.pointerType === "mouse") this.show();
        }}
        @pointerleave=${(event: PointerEvent) => {
          if (event.pointerType === "mouse") this.hide();
        }}
        ><slot></slot
      ></span>
      <div
        popover="manual"
        role="tooltip"
        class=${clsx(
          "fixed inset-auto m-0 box-border max-w-[calc(100vw-16px)] border-0 rounded-full px-3 py-1.5",
          "bg-[#202020] text-white font-sans text-xs font-semibold leading-[18px] [overflow-wrap:anywhere]",
          "[box-shadow:0_6px_18px_rgb(0_0_0_/_18%)]",
        )}
      >
        ${this.label}
      </div>`;
  }

  private readonly hide = () => {
    window.removeEventListener("wheel", this.hide, true);
    this.renderRoot.querySelector<HTMLElement>("[popover]")?.hidePopover();
  };

  private show() {
    if (!this.label.trim() || !this.isConnected) return;
    const tooltip = this.renderRoot.querySelector<HTMLElement>("[popover]");
    if (!tooltip) return;
    tooltip.showPopover();
    window.addEventListener("wheel", this.hide, { capture: true, passive: true, once: true });
    const anchor = this.renderRoot.querySelector("span")!.getBoundingClientRect();
    const { width, height } = tooltip.getBoundingClientRect();
    const gap = getSpace(1);
    const below = anchor.bottom + gap;
    const above = anchor.top - height - gap;
    const top =
      this.placement === "top"
        ? above >= 8
          ? above
          : below
        : below + height <= window.innerHeight - 8
          ? below
          : above;
    tooltip.style.left = `${Math.max(8, Math.min(anchor.left + (anchor.width - width) / 2, window.innerWidth - width - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
  }
}
