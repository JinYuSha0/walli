import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { ArrowUp, ImagePlus, Mic, Plus, Square, X, createElement } from "lucide";
import clsx from "clsx";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import type {
  WalliChatComposerActionCallback,
  WalliChatComposerSubmitCallback,
  WalliChatComposerValueCallback,
} from "../types";

type ImageAttachment = {
  file: File;
  id: string;
  url: string;
};

const createIcon = (icon: Parameters<typeof createElement>[0], size = 20) =>
  createElement(icon, { "aria-hidden": "true", height: size, width: size });

const singleLineTextareaHeight = 40;

@customElement("walli-chat-composer")
export class WalliChatComposerElement extends LitElement {
  static override styles = css`
    :host {
      color-scheme: inherit;
      display: block;
      width: 100%;
    }
  `;

  override createRenderRoot() {
    const renderRoot = super.createRenderRoot();
    const unoStyle = document.createElement("style");
    unoStyle.textContent = walliChatUnoCss;
    renderRoot.append(unoStyle);
    return renderRoot;
  }

  @property({ type: Boolean }) accessor disabled = false;
  @property({ attribute: "max-height", type: Number }) accessor maxHeight = 200;
  @property() accessor placeholder = "Message";
  @property() accessor value = "";
  @property({ attribute: false }) accessor onCancel: WalliChatComposerActionCallback | undefined;
  @property({ attribute: false }) accessor onSubmit: WalliChatComposerSubmitCallback | undefined;
  @property({ attribute: false }) accessor onValueChange:
    WalliChatComposerValueCallback | undefined;
  @property({ attribute: false }) accessor onVoice: WalliChatComposerActionCallback | undefined;

  @state() private accessor attachments: ImageAttachment[] = [];
  @state() private accessor expanded = false;
  @state() private accessor menuOpen = false;
  @state() private accessor running = false;
  @query("textarea") private accessor textareaElement!: HTMLTextAreaElement;
  @query('input[type="file"]') private accessor fileInputElement!: HTMLInputElement;
  private lastMeasuredValue: string | undefined;
  private resizeAnimationFrame: number | undefined;

  override updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (
      changedProperties.has("maxHeight") ||
      (changedProperties.has("value") && this.lastMeasuredValue !== this.value)
    ) {
      this.resizeTextarea();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.resizeAnimationFrame !== undefined) {
      cancelAnimationFrame(this.resizeAnimationFrame);
      this.resizeAnimationFrame = undefined;
    }
    this.revokeAttachments(this.attachments);
  }

  focus(): void {
    this.textareaElement?.focus();
  }

  private resizeTextarea(): void {
    const textarea = this.textareaElement;
    if (!textarea) return;

    if (this.resizeAnimationFrame !== undefined) {
      cancelAnimationFrame(this.resizeAnimationFrame);
      this.resizeAnimationFrame = undefined;
    }

    const currentHeight = textarea.getBoundingClientRect().height;
    const maxHeight = Math.max(
      singleLineTextareaHeight,
      Number.isFinite(this.maxHeight) ? this.maxHeight : 200,
    );
    textarea.style.transition = "none";
    textarea.style.maxHeight = `${maxHeight}px`;
    textarea.style.height = "0px";
    const contentHeight = textarea.scrollHeight;
    const height = Math.min(maxHeight, Math.max(singleLineTextareaHeight, contentHeight));
    textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
    textarea.style.height = `${currentHeight}px`;
    void textarea.offsetHeight;
    textarea.style.removeProperty("transition");

    if (currentHeight === height) {
      textarea.style.height = `${height}px`;
    } else {
      this.resizeAnimationFrame = requestAnimationFrame(() => {
        textarea.style.height = `${height}px`;
        this.resizeAnimationFrame = undefined;
      });
    }

    this.lastMeasuredValue = textarea.value;
    this.expanded = height > singleLineTextareaHeight;
  }

  private handleInput(event: Event): void {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    this.value = textarea.value;
    this.resizeTextarea();
    this.onValueChange?.(this.value);
  }

  private handleSurfaceClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest("button, input, img")) return;
    this.focus();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void this.submit();
  }

  private async submit(): Promise<void> {
    if (this.disabled || this.running || !this.canSubmit) return;
    const files = this.attachments.map((attachment) => attachment.file);
    this.running = true;
    this.clearAttachments();
    void this.updateComplete.then(() => this.resizeTextarea());
    try {
      await this.onSubmit?.(this.value.trim(), files);
    } finally {
      this.running = false;
    }
  }

  private get canSubmit(): boolean {
    return this.value.trim().length > 0 || this.attachments.length > 0;
  }

  private handlePrimaryAction(): void {
    if (this.running) {
      this.onCancel?.();
      return;
    }
    void this.submit();
  }

  private openFilePicker(): void {
    this.menuOpen = false;
    this.fileInputElement?.click();
  }

  private handleFiles(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])].filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) {
      this.attachments = [
        ...this.attachments,
        ...files.map((file) => ({
          file,
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
        })),
      ];
    }
    input.value = "";
  }

  private removeAttachment(id: string): void {
    const attachment = this.attachments.find((item) => item.id === id);
    if (attachment) URL.revokeObjectURL(attachment.url);
    this.attachments = this.attachments.filter((item) => item.id !== id);
  }

  private clearAttachments(): void {
    this.revokeAttachments(this.attachments);
    this.attachments = [];
  }

  private revokeAttachments(attachments: readonly ImageAttachment[]): void {
    for (const attachment of attachments) URL.revokeObjectURL(attachment.url);
  }

  override render() {
    return html`<div
      class="relative box-border min-h-[52px] cursor-text rounded-[28px] bg-card px-2 py-[5px] text-card-foreground [box-shadow:0_0_0_1px_var(--border),0_2px_8px_rgb(0_0_0_/_8%),0_4px_40px_8px_rgb(0_0_0_/_5%)]"
      @click=${this.handleSurfaceClick}
    >
      ${
        this.attachments.length > 0
          ? html`<div
              class="flex gap-2 overflow-x-auto px-0.5 pb-2 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Selected images"
            >
              ${this.attachments.map(
                (attachment) =>
                  html`<div class="relative h-[72px] flex-[0_0_72px] overflow-hidden rounded-xl">
                    <img
                      class="h-full w-full object-cover"
                      src=${attachment.url}
                      alt=${attachment.file.name}
                    />
                    <button
                      class=${clsx(
                        "[-webkit-appearance:none] [-webkit-tap-highlight-color:transparent] absolute right-1 top-1 inline-flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-0 bg-black/70 p-0 text-white focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      )}
                      type="button"
                      aria-label=${`Remove ${attachment.file.name}`}
                      @click=${() => this.removeAttachment(attachment.id)}
                    >
                      ${createIcon(X, 14)}
                    </button>
                  </div>`,
              )}
            </div>`
          : nothing
      }

      <div
        class=${
          this.expanded
            ? "grid grid-cols-[1fr_auto]"
            : "grid min-h-[42px] grid-cols-[auto_1fr_auto] items-center"
        }
      >
        <div class=${clsx("flex items-center", this.expanded && "col-start-1 row-start-2")}>
          <button
            class=${clsx(
              "[-webkit-appearance:none] [-webkit-tap-highlight-color:transparent] inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground transition-colors duration-150 enabled:hover:bg-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
              this.menuOpen && "bg-accent",
            )}
            type="button"
            aria-label="Add"
            aria-expanded=${this.menuOpen ? "true" : "false"}
            ?disabled=${this.disabled || this.running}
            @click=${() => (this.menuOpen = !this.menuOpen)}
          >
            ${createIcon(Plus)}
          </button>
          ${
            this.menuOpen
              ? html`<div
                  class=${clsx(
                    "absolute left-0 right-0 z-20 origin-bottom-left rounded-[20px] bg-popover px-2 py-2.5 text-popover-foreground [box-shadow:0_0_0_1px_var(--border),0_2px_8px_rgb(0_0_0_/_12%),0_4px_40px_8px_rgb(0_0_0_/_8%)]",
                    this.expanded ? "bottom-[48px]" : "bottom-[56px]",
                  )}
                >
                  <button
                    class=${clsx(
                      "[-webkit-appearance:none] [-webkit-tap-highlight-color:transparent] inline-flex h-9 w-full cursor-pointer items-center justify-start gap-3 rounded-xl border-0 bg-transparent px-2 font-sans text-sm font-medium leading-5 text-inherit hover:bg-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    )}
                    type="button"
                    @click=${this.openFilePicker}
                  >
                    ${createIcon(ImagePlus, 18)} Add photos
                  </button>
                </div>`
              : nothing
          }
          <input class="hidden" type="file" accept="image/*" multiple @change=${this.handleFiles} />
        </div>

        <textarea
          name="prompt-textarea"
          class=${clsx(
            "box-border block h-10 min-h-10 w-full min-w-0 cursor-text select-text resize-none overflow-x-hidden overflow-y-hidden whitespace-pre-wrap break-words border-0 bg-transparent px-[7px] py-2 font-sans text-base leading-6 text-inherit outline-none transition-[height,padding] duration-150 [transition-timing-function:ease] motion-reduce:transition-none [scrollbar-color:var(--muted-foreground)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
            this.expanded && "col-span-2 col-start-1 row-start-1",
          )}
          .value=${this.value}
          ?disabled=${this.disabled}
          placeholder=${this.placeholder}
          rows="1"
          aria-label=${this.placeholder}
          @input=${this.handleInput}
          @keydown=${this.handleKeyDown}
        ></textarea>

        <div class=${clsx("flex items-center gap-1", this.expanded && "col-start-2 row-start-2")}>
          <button
            class=${clsx(
              "[-webkit-appearance:none] [-webkit-tap-highlight-color:transparent] inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground transition-colors duration-150 enabled:hover:bg-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
            )}
            type="button"
            aria-label="Start voice input"
            ?disabled=${this.disabled || this.running}
            @click=${() => this.onVoice?.()}
          >
            ${createIcon(Mic)}
          </button>
          <button
            class=${clsx(
              "[-webkit-appearance:none] [-webkit-tap-highlight-color:transparent] inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 p-0 transition-[opacity,transform] duration-150 enabled:hover:scale-105 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none",
              "bg-foreground text-background",
            )}
            type="button"
            aria-label=${this.running ? "Stop generating" : "Send message"}
            ?disabled=${this.disabled || (!this.running && !this.canSubmit)}
            @click=${this.handlePrimaryAction}
          >
            ${
              this.running
                ? createElement(Square, {
                    "aria-hidden": "true",
                    fill: "currentColor",
                    height: 14,
                    width: 14,
                  })
                : createIcon(ArrowUp, 19)
            }
          </button>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "walli-chat-composer": WalliChatComposerElement;
  }
}
