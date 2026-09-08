import "./walli-tooltip";
import { Copy, Pencil, Share2, ThumbsDown, ThumbsUp, createElement } from "lucide";
import type { IconNode } from "lucide";
import { html, nothing, render } from "lit";
import { customElement } from "lit/decorators.js";
import type {
  WalliChatActionConfig,
  WalliChatActionComponent,
  WalliChatActionItemConfig,
  WalliChatCustomActionConfig,
  WalliChatMessageType,
  WalliChatSetActionIcon,
} from "../types";
import type { WalliChatMessageBlockState } from "../core/block-registry";

export type WalliActionButtonConfig = {
  icon?: IconNode;
  label?: string;
  onAction?: () => void;
  text?: string;
  type?: string;
};

export type MessageActionItem = {
  component?: WalliChatActionComponent;
  icon?: IconNode;
  label?: string;
  sort: number;
  type: string;
};

export type MessageActionIconSetter = (type: string, icon?: IconNode) => void;
export type MessageActionsContext<Config> = {
  actionConfig: Config;
  blockStates: Map<string, WalliChatMessageBlockState>;
  id: string;
  markdown: string;
  getBlockState: (key: string) => unknown;
  setBlockState: (key: string, value: unknown) => void;
};

export function isActionVisible(config: WalliChatActionItemConfig | undefined, fallback: boolean) {
  if (config === undefined) return fallback;
  if (typeof config === "boolean") return config;
  return config.visible;
}

export function getActionSort(config: WalliChatActionItemConfig | undefined, fallback: number) {
  return typeof config === "object" ? (config.sort ?? fallback) : fallback;
}

export function sortActionItems(items: MessageActionItem[]): MessageActionItem[] {
  return items.sort((left, right) => left.sort - right.sort);
}

export type MessageActionRole = "assistant" | "user";
type BuiltInActionConfig = {
  defaultSort: number;
  defaultVisible: boolean;
  items: readonly { icon: IconNode; label: string; type: string }[];
  name: "copy" | "edit" | "feedback" | "share";
};

const builtInActions: Record<MessageActionRole, readonly BuiltInActionConfig[]> = {
  assistant: [
    {
      defaultSort: 1,
      defaultVisible: true,
      items: [{ icon: Copy, label: "Copy", type: "copy" }],
      name: "copy",
    },
    {
      defaultSort: 2,
      defaultVisible: false,
      items: [
        { icon: ThumbsUp, label: "Good response", type: "like" },
        { icon: ThumbsDown, label: "Bad response", type: "dislike" },
      ],
      name: "feedback",
    },
    {
      defaultSort: 3,
      defaultVisible: false,
      items: [{ icon: Share2, label: "Share", type: "share" }],
      name: "share",
    },
  ],
  user: [
    {
      defaultSort: 1,
      defaultVisible: true,
      items: [{ icon: Copy, label: "Copy", type: "copy" }],
      name: "copy",
    },
    {
      defaultSort: 2,
      defaultVisible: false,
      items: [{ icon: Pencil, label: "Edit", type: "edit" }],
      name: "edit",
    },
  ],
};

export function createMessageActionItems<Role extends MessageActionRole>(
  role: Role,
  config: NonNullable<WalliChatActionConfig[Role]>,
): MessageActionItem[] {
  const actionConfig = config as Record<string, WalliChatActionItemConfig | undefined>;
  const builtIns = builtInActions[role];
  const builtInNames = new Set(builtIns.map((builtIn) => builtIn.name));
  const customConfigs = Object.entries(config).filter(
    (entry): entry is [string, WalliChatCustomActionConfig] => {
      const [name, value] = entry;
      return !builtInNames.has(name as BuiltInActionConfig["name"]) && typeof value === "object";
    },
  );
  const customTypes = new Set(customConfigs.map(([type]) => type));
  const items: MessageActionItem[] = customConfigs
    .filter(([, value]) => value.visible)
    .map<MessageActionItem>(([type, value], index) => ({
      component: value.component,
      icon: value.icon,
      label: value.label,
      sort: value.sort ?? index + 1,
      type,
    }));

  for (const builtIn of builtIns) {
    if (customTypes.has(builtIn.name)) continue;
    const value = actionConfig[builtIn.name];
    if (!isActionVisible(value, builtIn.defaultVisible)) continue;
    const sort = getActionSort(value, builtIn.defaultSort);
    items.push(
      ...builtIn.items.map((item, index) => ({
        icon: item.icon,
        label: typeof value === "object" ? (value.label ?? item.label) : item.label,
        sort: sort + index / 10,
        type: item.type,
      })),
    );
  }
  return sortActionItems(items);
}

export function createMessageActionDetail(
  item: MessageActionItem,
  messageId: string,
  messageType: WalliChatMessageType,
  markdown: string,
  setIcon: MessageActionIconSetter,
  getBlockState: (key: string) => unknown,
  setBlockState: (key: string, value: unknown) => void,
) {
  const actionSetIcon: WalliChatSetActionIcon = (icon, type) => setIcon(type ?? item.type, icon);
  return {
    messageId,
    messageType,
    markdown,
    getBlockState,
    setBlockState,
    setIcon: actionSetIcon,
    type: item.type,
  };
}

const actionIcons: Record<string, () => SVGElement> = {
  copy: () => createActionIcon(Copy),
  dislike: () => createActionIcon(ThumbsDown),
  like: () => createActionIcon(ThumbsUp),
  edit: () => createActionIcon(Pencil),
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
  private config: WalliActionButtonConfig = { type: "copy" };

  connectedCallback(): void {
    this.renderButton();
  }

  set action(value: WalliActionButtonConfig) {
    this.config = value;
    if (this.isConnected) this.renderButton();
  }

  private performAction(): void {
    if (this.config.type === "copy") {
      void navigator.clipboard.writeText(this.config.text ?? "");
    }
    this.config.onAction?.();
  }

  private renderButton(): void {
    const label = this.config.label;
    render(
      html`<walli-tooltip .label=${label ?? ""}
        ><button
          class="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-visible rounded-lg border-0 bg-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          type="button"
          aria-label=${label ?? nothing}
          @click=${() => this.performAction()}
        >
          ${
            this.config.icon
              ? createActionIcon(this.config.icon)
              : this.config.type
                ? actionIcons[this.config.type]?.()
                : null
          }
        </button></walli-tooltip
      >`,
      this,
    );
  }
}
