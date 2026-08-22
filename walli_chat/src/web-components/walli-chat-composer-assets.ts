import { html, nothing, render } from "lit";
import { customElement } from "lit/decorators.js";
import {
  CircleAlert,
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  X,
  createElement,
  type IconNode,
} from "lucide";
import clsx from "clsx";
import type { WalliChatComposerRemoveImageCallback } from "../types";

export type ComposerAttachment = {
  file: globalThis.File;
  id: string;
  onRemove?: WalliChatComposerRemoveImageCallback;
  progress: number;
  status: "uploading" | "ready" | "error";
  assetUrl?: string;
  error?: Error;
  url: string;
};

const createIcon = (icon: IconNode, size = 20) =>
  createElement(icon, { "aria-hidden": "true", height: size, width: size });

@customElement("walli-chat-composer-assets")
export class WalliChatComposerAssetsElement extends HTMLElement {
  private currentAttachments: readonly ComposerAttachment[] = [];
  onRemove: ((id: string) => void) | undefined;

  set attachments(value: readonly ComposerAttachment[]) {
    this.currentAttachments = value;
    this.renderAssets();
  }

  get attachments(): readonly ComposerAttachment[] {
    return this.currentAttachments;
  }

  private renderAssets(): void {
    render(
      html`<style>
          .composer-asset-remove {
            opacity: 0;
            pointer-events: none;
          }
          .composer-asset:hover .composer-asset-remove,
          .composer-asset-remove:focus-visible {
            opacity: 1;
            pointer-events: auto;
          }
          .composer-asset-name {
            display: -webkit-box;
            overflow: hidden;
            overflow-wrap: anywhere;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
          }
          @media (hover: none), (pointer: coarse) {
            .composer-asset-remove {
              opacity: 1;
              pointer-events: auto;
            }
          }
        </style>
        <div
          class="grid cursor-default justify-items-center gap-y-2 px-1 pb-2.5 pt-1 [grid-template-columns:repeat(auto-fill,minmax(80px,1fr))]"
          aria-label="Selected files"
        >
          ${this.currentAttachments.map((attachment) => this.renderAttachment(attachment))}
        </div>`,
      this,
    );
  }

  private renderAttachment(attachment: ComposerAttachment) {
    const isImage = attachment.file.type.startsWith("image/");
    return html`<div
      class=${clsx(
        "composer-asset relative box-border h-20 w-20 overflow-hidden rounded-2xl bg-muted [border:1px_solid_var(--border)]",
        !isImage && "flex flex-col items-center justify-between px-2 py-2",
      )}
    >
      ${
        isImage
          ? html`<img
              class="h-full w-full object-cover"
              src=${attachment.url}
              alt=${attachment.file.name}
            />`
          : html`<span
                class="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-background text-foreground"
              >
                ${createIcon(getFileIcon(attachment.file), 20)}
              </span>
              <span
                class="composer-asset-name w-full text-center text-[10px] font-medium leading-3"
                title=${attachment.file.name}
                >${attachment.file.name}</span
              >`
      }
      ${
        attachment.status === "uploading"
          ? html`<div
              class="absolute inset-0 flex items-center justify-center bg-white/15 [backdrop-filter:blur(8px)] [-webkit-backdrop-filter:blur(8px)] dark:bg-black/20"
              aria-label=${`Uploading ${attachment.file.name}: ${Math.round(attachment.progress)}%`}
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow=${Math.round(attachment.progress)}
            >
              <svg class="h-7 w-7 -rotate-90 drop-shadow-sm" viewBox="0 0 28 28" aria-hidden="true">
                <circle
                  cx="14"
                  cy="14"
                  r="10"
                  fill="none"
                  stroke="rgb(255 255 255 / 0.3)"
                  stroke-width="2.5"
                ></circle>
                <circle
                  cx="14"
                  cy="14"
                  r="10"
                  fill="none"
                  stroke="white"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-dasharray="62.83"
                  stroke-dashoffset=${62.83 * (1 - attachment.progress / 100)}
                  class="transition-[stroke-dashoffset] duration-150 ease-out"
                ></circle>
              </svg>
            </div>`
          : attachment.status === "error"
            ? html`<div
                class="absolute inset-0 flex items-center justify-center bg-black/45 text-white [backdrop-filter:blur(3px)] [-webkit-backdrop-filter:blur(3px)]"
                aria-label=${`Upload failed for ${attachment.file.name}: ${attachment.error?.message ?? "Unknown error"}`}
                title=${attachment.error?.message ?? "Upload failed"}
                role="status"
              >
                ${createIcon(CircleAlert, 28)}
              </div>`
            : nothing
      }
      <button
        class="composer-asset-remove [-webkit-appearance:none] [-webkit-tap-highlight-color:transparent] absolute right-1 top-1 z-10 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-black/65 p-0 text-white shadow-sm transition-[background-color,opacity] duration-150 hover:bg-black/80 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        type="button"
        aria-label=${`Remove ${attachment.file.name}`}
        @click=${() => this.onRemove?.(attachment.id)}
      >
        ${createIcon(X, 12)}
      </button>
    </div>`;
  }
}

function getFileIcon(file: globalThis.File): IconNode {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type.startsWith("image/")) return FileImage;
  if (file.type.startsWith("audio/")) return FileAudio;
  if (file.type.startsWith("video/")) return FileVideo;
  if (["xls", "xlsx", "csv", "ods"].includes(extension)) return FileSpreadsheet;
  if (["ppt", "pptx", "odp", "key"].includes(extension)) return Presentation;
  if (["doc", "docx", "odt", "pdf", "rtf", "txt"].includes(extension)) return FileText;
  if (["zip", "rar", "7z", "gz", "tar"].includes(extension)) return FileArchive;
  if (
    ["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "go", "rs", "java"].includes(extension)
  )
    return FileCode2;
  return File;
}

declare global {
  interface HTMLElementTagNameMap {
    "walli-chat-composer-assets": WalliChatComposerAssetsElement;
  }
}
