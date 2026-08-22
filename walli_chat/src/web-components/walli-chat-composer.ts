import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { measureLineStats, prepareWithSegments } from "@chenglou/pretext";
import { ArrowUp, Mic, Paperclip, Plus, Square, createElement } from "lucide";
import clsx from "clsx";
import walliChatUnoCss from "virtual:walli-chat-uno-styles";
import type {
  WalliChatComposerActionCallback,
  WalliChatComposerInsertedAssetsHandle,
  WalliChatComposerInsertAsset,
  WalliChatComposerMenuItem,
  WalliChatComposerSubmitCallback,
  WalliChatComposerUploadImagesCallback,
  WalliChatComposerValueCallback,
} from "../types";
import type { ComposerAttachment } from "./walli-chat-composer-assets";
import "./walli-chat-composer-assets";

const createIcon = (icon: Parameters<typeof createElement>[0], size = 20) =>
  createElement(icon, { "aria-hidden": "true", height: size, width: size });

const singleLineTextareaHeight = 40;

@customElement("walli-chat-composer")
export class WalliChatComposerElement extends LitElement {
  static override styles = css`
    :host {
      color-scheme: inherit;
      display: block;
      min-height: 52px;
      touch-action: manipulation;
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
  @property({ attribute: "upload-images-title" }) accessor uploadImagesTitle = "Add files";
  @property() accessor value = "";
  @property({ attribute: false }) accessor onCancel: WalliChatComposerActionCallback | undefined;
  @property({ attribute: false }) accessor onSubmit: WalliChatComposerSubmitCallback | undefined;
  @property({ attribute: false }) accessor onUploadImages:
    WalliChatComposerUploadImagesCallback | undefined;
  @property({ attribute: false }) accessor onValueChange:
    WalliChatComposerValueCallback | undefined;
  @property({ attribute: false }) accessor onVoice: WalliChatComposerActionCallback | undefined;
  @property({ attribute: false }) accessor menuItems: readonly WalliChatComposerMenuItem[] = [];

  @state() private accessor attachments: ComposerAttachment[] = [];
  @state() private accessor expanded = false;
  @state() private accessor menuOpen = false;
  @state() private accessor running = false;
  @query(".composer-grid") private accessor gridElement!: HTMLDivElement;
  @query("textarea") private accessor textareaElement!: HTMLTextAreaElement;
  @query('input[type="file"]') private accessor fileInputElement!: HTMLInputElement;
  private lastMeasuredValue: string | undefined;
  private resizeAnimationFrame: number | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("pointerdown", this.handleDocumentPointerDown);
    document.addEventListener("keydown", this.handleDocumentKeyDown);
  }

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
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown);
    document.removeEventListener("keydown", this.handleDocumentKeyDown);
    if (this.resizeAnimationFrame !== undefined) {
      cancelAnimationFrame(this.resizeAnimationFrame);
      this.resizeAnimationFrame = undefined;
    }
    this.revokeAttachments(this.attachments);
  }

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (this.menuOpen && !event.composedPath().includes(this)) this.menuOpen = false;
  };

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (this.menuOpen && event.key === "Escape") this.menuOpen = false;
  };

  focus(): void {
    this.textareaElement?.focus();
  }

  insertAssets(
    assets: readonly WalliChatComposerInsertAsset[],
  ): WalliChatComposerInsertedAssetsHandle {
    const attachments = assets.map<ComposerAttachment>((asset) => ({
      assetUrl: asset.url,
      file: asset.file,
      id: crypto.randomUUID(),
      progress: asset.url ? 100 : 0,
      status: asset.url ? "ready" : "uploading",
      url: asset.url ?? URL.createObjectURL(asset.file),
    }));
    if (attachments.length > 0) this.attachments = [...this.attachments, ...attachments];
    return this.createUploadHandle(attachments);
  }

  private createUploadHandle(
    attachments: readonly ComposerAttachment[],
  ): WalliChatComposerInsertedAssetsHandle {
    const attachmentIds = new Set(attachments.map((attachment) => attachment.id));
    return {
      setProgress: (file, progress) => {
        const normalizedProgress = Math.min(100, Math.max(0, progress));
        this.attachments = this.attachments.map((attachment) =>
          attachmentIds.has(attachment.id) && attachment.file === file
            ? { ...attachment, progress: normalizedProgress }
            : attachment,
        );
      },
      setResult: (file, result) => {
        this.attachments = this.attachments.map((attachment) => {
          if (!attachmentIds.has(attachment.id) || attachment.file !== file) return attachment;
          return "url" in result
            ? {
                ...attachment,
                assetUrl: result.url,
                error: undefined,
                progress: 100,
                status: "ready",
              }
            : { ...attachment, assetUrl: undefined, error: result.error, status: "error" };
        });
      },
    };
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

    const gridWidth = this.gridElement?.clientWidth ?? textarea.clientWidth;
    const gridChildren = this.gridElement?.children;
    const leadingWidth =
      gridChildren?.item(0)?.querySelector(":scope > button")?.getBoundingClientRect().width ?? 0;
    const trailingWidth = gridChildren
      ? (gridChildren.item(gridChildren.length - 1)?.getBoundingClientRect().width ?? 0)
      : 0;
    const collapsedWidth = Math.max(1, gridWidth - leadingWidth - trailingWidth);

    let shouldExpand = this.expanded && this.value.length > 0;
    if (!this.expanded) {
      const textareaStyle = getComputedStyle(textarea);
      const horizontalPadding =
        Number.parseFloat(textareaStyle.paddingLeft) +
        Number.parseFloat(textareaStyle.paddingRight);
      const textWidth = Math.max(1, collapsedWidth - horizontalPadding);
      const font =
        textareaStyle.font ||
        `${textareaStyle.fontStyle} ${textareaStyle.fontWeight} ${textareaStyle.fontSize} ${textareaStyle.fontFamily}`;
      const prepared = prepareWithSegments(this.value, font, { whiteSpace: "pre-wrap" });
      shouldExpand = measureLineStats(prepared, textWidth).lineCount > 1;
    }

    textarea.style.width = `${shouldExpand ? gridWidth : collapsedWidth}px`;
    textarea.style.height = "0px";
    const contentHeight = textarea.scrollHeight;
    const height = Math.min(maxHeight, Math.max(singleLineTextareaHeight, contentHeight));
    textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
    textarea.style.removeProperty("width");
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
    this.expanded = shouldExpand;
  }

  private handleInput(event: Event): void {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    this.value = textarea.value;
    this.resizeTextarea();
    this.onValueChange?.(this.value);
  }

  private handleMenuToggle(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) this.textareaElement?.blur();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void this.submit();
  }

  private dismissKeyboard(): void {
    const textarea = this.textareaElement;
    if (!textarea) return;
    textarea.blur();
    requestAnimationFrame(() => textarea.blur());
  }

  private async submit(): Promise<void> {
    if (this.disabled || this.running || !this.canSubmit) return;
    this.menuOpen = false;
    const assets = this.attachments.flatMap((attachment) =>
      attachment.status === "ready" && attachment.assetUrl
        ? [
            {
              file: attachment.file,
              type: attachment.file.type.startsWith("image/")
                ? ("image" as const)
                : ("file" as const),
              url: attachment.assetUrl,
            },
          ]
        : [],
    );
    const text = this.value.trim();
    const markdown = createSubmitMarkdown(text, assets);
    this.dismissKeyboard();
    this.running = true;
    this.clearAttachments();
    void this.updateComplete.then(() => this.resizeTextarea());
    try {
      await this.onSubmit?.(markdown, text, assets);
    } finally {
      this.running = false;
    }
  }

  private get canSubmit(): boolean {
    if (this.attachments.some((attachment) => attachment.status === "uploading")) return false;
    return (
      this.value.trim().length > 0 ||
      this.attachments.some((attachment) => attachment.status === "ready")
    );
  }

  private handlePrimaryAction(event: MouseEvent): void {
    this.menuOpen = false;
    if (this.running) {
      this.onCancel?.();
      return;
    }
    (event.currentTarget as HTMLButtonElement).focus({ preventScroll: true });
    void this.submit();
  }

  private handleVoice(): void {
    this.menuOpen = false;
    this.onVoice?.();
  }

  private openFilePicker(): void {
    this.menuOpen = false;
    this.fileInputElement?.click();
  }

  private async handleFiles(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (files.length === 0 || !this.onUploadImages) return;

    const newAttachments: ComposerAttachment[] = files.map((file) => ({
      file,
      id: crypto.randomUUID(),
      progress: 0,
      status: "uploading",
      url: URL.createObjectURL(file),
    }));
    this.attachments = [...this.attachments, ...newAttachments];

    const { setProgress, setResult } = this.createUploadHandle(newAttachments);
    let onRemove: Awaited<ReturnType<WalliChatComposerUploadImagesCallback>> = undefined;
    try {
      onRemove = await this.onUploadImages(files, setProgress, setResult);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      for (const file of files) setResult(file, { error });
    }
    const removeCallback = typeof onRemove === "function" ? onRemove : undefined;
    const newAttachmentIds = new Set(newAttachments.map(({ id }) => id));
    this.attachments = this.attachments.map((attachment) =>
      newAttachmentIds.has(attachment.id)
        ? {
            ...attachment,
            onRemove: removeCallback,
            ...(attachment.status === "uploading"
              ? { error: new Error("Upload did not return a result"), status: "error" as const }
              : {}),
          }
        : attachment,
    );
    if (!removeCallback) return;

    const remainingIds = new Set(this.attachments.map(({ id }) => id));
    for (const attachment of newAttachments) {
      if (!remainingIds.has(attachment.id)) void removeCallback(attachment.file);
    }
  }

  private handleMenuItemClick(item: WalliChatComposerMenuItem): void {
    this.menuOpen = false;
    item.onClick();
  }

  private removeAttachment(id: string): void {
    const attachment = this.attachments.find((item) => item.id === id);
    if (attachment) {
      URL.revokeObjectURL(attachment.url);
      void attachment.onRemove?.(attachment.file);
    }
    this.attachments = this.attachments.filter((item) => item.id !== id);
  }

  private clearAttachments(): void {
    this.revokeAttachments(this.attachments);
    this.attachments = [];
  }

  private revokeAttachments(attachments: readonly ComposerAttachment[]): void {
    for (const attachment of attachments) URL.revokeObjectURL(attachment.url);
  }

  override render() {
    const hasMenuItems = Boolean(this.onUploadImages) || this.menuItems.length > 0;
    return html`<div
      class="relative box-border min-h-[52px] rounded-[28px] bg-card px-2 py-[5px] text-card-foreground [box-shadow:0_0_0_1px_var(--border),0_2px_8px_rgb(0_0_0_/_8%),0_4px_40px_8px_rgb(0_0_0_/_5%)]"
    >
      ${
        this.attachments.length > 0
          ? html`<walli-chat-composer-assets
              class="block w-full"
              .attachments=${this.attachments}
              .onRemove=${(id: string) => this.removeAttachment(id)}
            ></walli-chat-composer-assets>`
          : nothing
      }

      <div
        class=${clsx(
          "composer-grid grid min-h-[42px]",
          this.expanded ? "grid-cols-[1fr_auto]" : "grid-cols-[auto_1fr_auto] items-center",
        )}
      >
        <div class=${clsx("flex items-center", this.expanded && "col-start-1 row-start-2")}>
          ${
            hasMenuItems
              ? html`<button
                  class=${clsx(
                    "[-webkit-appearance:none] [-webkit-tap-highlight-color:transparent] inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground transition-colors duration-150 enabled:hover:bg-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
                    this.menuOpen && "bg-accent",
                  )}
                  type="button"
                  aria-label="Add"
                  aria-expanded=${this.menuOpen ? "true" : "false"}
                  ?disabled=${this.disabled || this.running}
                  @click=${this.handleMenuToggle}
                >
                  ${createIcon(Plus)}
                </button>`
              : nothing
          }
          ${
            hasMenuItems && this.menuOpen
              ? html`<div
                  class="absolute inset-x-0 z-20 flex origin-bottom-left flex-col gap-1.5 overflow-hidden rounded-2xl bg-popover p-2 text-popover-foreground [bottom:calc(100%+10px)] [border:1px_solid_var(--border)] [box-shadow:0_4px_12px_rgb(0_0_0_/_5%),0_1px_2px_rgb(0_0_0_/_3%)]"
                  role="menu"
                  aria-label="Add to message"
                >
                  ${
                    this.onUploadImages
                      ? html`<button
                          class=${clsx(
                            "[-webkit-appearance:none] [-webkit-tap-highlight-color:transparent] inline-flex h-11 w-full cursor-pointer items-center justify-start gap-4 rounded-xl border-0 bg-transparent px-3 font-sans text-sm font-medium leading-5 text-inherit transition-colors hover:bg-accent focus:outline-none focus-visible:bg-accent",
                          )}
                          type="button"
                          role="menuitem"
                          @click=${this.openFilePicker}
                        >
                          <span
                            class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-foreground"
                            >${createIcon(Paperclip, 18)}</span
                          >
                          <span>${this.uploadImagesTitle}</span>
                        </button>`
                      : nothing
                  }
                  ${this.menuItems.map(
                    (item) =>
                      html`<button
                        class="[-webkit-appearance:none] [-webkit-tap-highlight-color:transparent] inline-flex h-11 w-full cursor-pointer items-center justify-start gap-4 rounded-xl border-0 bg-transparent px-3 font-sans text-sm font-medium leading-5 text-inherit transition-colors hover:bg-accent focus:outline-none focus-visible:bg-accent"
                        type="button"
                        role="menuitem"
                        @click=${() => this.handleMenuItemClick(item)}
                      >
                        <span
                          class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-foreground"
                          >${createIcon(item.icon, 18)}</span
                        >
                        <span>${item.title}</span>
                      </button>`,
                  )}
                </div>`
              : nothing
          }
          ${
            this.onUploadImages
              ? html`<input class="hidden" type="file" multiple @change=${this.handleFiles} />`
              : nothing
          }
        </div>

        <textarea
          class=${clsx(
            "box-border block h-10 min-h-10 w-full min-w-0 cursor-text select-text resize-none overflow-x-hidden overflow-y-hidden whitespace-pre-wrap break-words border-0 bg-transparent px-[7px] py-2 font-sans text-base leading-6 text-inherit outline-none transition-[height,padding] duration-150 [transition-timing-function:ease] motion-reduce:transition-none [scrollbar-color:var(--muted-foreground)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
            this.expanded && "col-span-2 col-start-1 row-start-1",
          )}
          .value=${this.value}
          ?disabled=${this.disabled}
          placeholder=${this.placeholder}
          rows="1"
          autocomplete="off"
          autocapitalize="sentences"
          autocorrect="on"
          enterkeyhint="send"
          inputmode="text"
          spellcheck="true"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
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
            @click=${this.handleVoice}
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

function createSubmitMarkdown(
  text: string,
  assets: readonly { file: File; type: "file" | "image"; url: string }[],
): string {
  const assetBlocks = assets
    .map((asset) =>
      asset.type === "image"
        ? `![${escapeMarkdownAlt(asset.file.name)}](<${asset.url}>)`
        : `[${escapeMarkdownAlt(asset.file.name)}](<${asset.url}>)`,
    )
    .join("\n\n");
  return [assetBlocks, text].filter(Boolean).join("\n\n");
}

function escapeMarkdownAlt(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("]", "\\]");
}

declare global {
  interface HTMLElementTagNameMap {
    "walli-chat-composer": WalliChatComposerElement;
  }
}
