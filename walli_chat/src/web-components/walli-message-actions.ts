import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { getOrCreateMessageBlockState } from "../core/block-registry";
import type { WalliChatActionConfig, WalliChatSetActionIcon } from "../types";
import {
  createMessageActionDetail,
  createMessageActionItems,
  type MessageActionIconSetter,
  type MessageActionItem,
  type MessageActionRole,
  type MessageActionsContext,
} from "./walli-action-button";

@customElement("walli-message-actions")
export class WalliMessageActionsElement extends LitElement {
  @property({ attribute: false })
  accessor context!: MessageActionsContext<NonNullable<WalliChatActionConfig[MessageActionRole]>>;

  @property({ attribute: false })
  accessor variant: MessageActionRole = "assistant";

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override render() {
    const items = createMessageActionItems(this.variant, this.context.actionConfig);
    const className =
      this.variant === "assistant"
        ? "flex h-[50px] items-start gap-1"
        : "flex h-10 items-center justify-end gap-1 opacity-100 transition-opacity [@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100";
    return html`<div class=${className}>${items.map((item) => this.renderAction(item))}</div>`;
  }

  private renderAction(item: MessageActionItem) {
    const setIcon = this.createSetIcon(item);
    const blockState = this.context.blockStates.get(this.context.id);
    const icon = blockState?.actionIcons.get(item.type) ?? item.icon;
    if (!icon) {
      const component = item.component?.({ blockStates: blockState?.values, setIcon });
      if (component) return component;
    }
    return html`<walli-action-button
      .action=${{
        icon,
        kind: item.kind,
        label: item.label,
        onAction: () => this.emit(item),
        text: item.type === "copy" ? this.context.markdown : undefined,
      }}
    ></walli-action-button>`;
  }

  private emit(item: MessageActionItem): void {
    this.dispatchEvent(
      new CustomEvent("walli-message-action", {
        bubbles: true,
        composed: true,
        detail: createMessageActionDetail(
          item,
          this.context.id,
          this.variant,
          this.context.markdown,
          this.createIconSetter(),
          this.context.getBlockState,
          this.context.setBlockState,
        ),
      }),
    );
  }

  private createSetIcon(item: MessageActionItem): WalliChatSetActionIcon {
    const setIcon = this.createIconSetter();
    return (icon, type) => setIcon(type ?? item.type, icon);
  }

  private createIconSetter(): MessageActionIconSetter {
    return (type, icon) => {
      if (icon === undefined) {
        this.context.blockStates.get(this.context.id)?.actionIcons.delete(type);
      } else {
        getOrCreateMessageBlockState(this.context.blockStates, this.context.id).actionIcons.set(
          type,
          icon,
        );
      }
      this.requestUpdate();
    };
  }
}
